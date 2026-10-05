import uuid
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json
from backend.modules.deploy.repositories.onboarding_repo import OnboardingRepository
from backend.common.services.email_service import EmailService
from backend.modules.deploy.services.notification_service import add_notification
from backend.common.utils.name_utils import join_name_parts
from passlib.hash import pbkdf2_sha256

class OnboardingService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = OnboardingRepository()
        self.tenant_id = tenant_id
        self.email_service = EmailService(tenant_id=tenant_id)

    def create_invite(self, data: Dict[str, Any], tenant_id: str = 'public'):
        existing_user = self.repo.get_user_by_email(data['email'], tenant_id=tenant_id)
        if not data.get("is_rehire") and existing_user and existing_user.get('role') != 'trainee':
            raise ValueError("User with this email already exists.")
            
        if self.repo.get_pending_invite_by_email(data['email']):
            raise ValueError("Pending invite already exists for this email.")

        if data.get('employee_code') and self.repo.check_employee_code_exists(data['employee_code'], tenant_id=tenant_id):
            raise ValueError("Employee code already in use.")

        token = str(uuid.uuid4())
        expires_at = datetime.now() + timedelta(days=7)

        name = join_name_parts(data.get('first_name'), data.get('middle_name'), data.get('last_name'))
        invite_data = {
            "token": token,
            "email": data['email'],
            "name": name,
            "first_name": data.get('first_name'),
            "middle_name": data.get('middle_name'),
            "last_name": data.get('last_name'),
            "employee_code": data.get('employee_code'),
            "guardian_name": data.get('guardian_name'),
            "role": data.get('role', 'Employee'),
            "department": data.get('department'),
            "designation": data.get('designation'),
            "doj": data.get('doj'),
            "expires_at": expires_at
        }
        
        self.repo.create_invite(invite_data, tenant_id=tenant_id)
        
        # Generate the onboarding link
        relative_link = f"/onboard?token={token}"
        
        # Try to send email
        email_sent = False
        email_message = ""
        
        if self.email_service.is_configured():
            # Use the tenant's portal URL (resolves to {subdomain}.phygitron.com)
            full_link = f"{self.email_service.portal_url}{relative_link}"
            
            email_result = self.email_service.send_onboarding_invitation(
                recipient_email=data['email'],
                recipient_name=data.get('first_name') or name,
                onboarding_link=full_link,
                expires_days=7
            )
            
            email_sent = email_result['success']
            email_message = email_result['message']
        else:
            email_message = "Email not configured. Link generated for manual sharing."
        
        return {
            "success": True, 
            "message": email_message if email_sent else f"Invite created, but email failed: {email_message}",
            "email_sent": email_sent,
            "token": token,
            "link": relative_link
        }

    def get_all_invites(self, tenant_id: str = 'public'):
        return self.repo.get_all_invites(tenant_id=tenant_id)

    def revoke_invite(self, invite_id: int):
        self.repo.revoke_invite(invite_id)
        return {"success": True, "message": "Invite revoked"}

    def delete_invite(self, invite_id: int):
        self.repo.delete_invite(invite_id)
        return {"success": True, "message": "Invite permanently deleted"}

    def verify_token(self, token: str):
        invite = self.repo.get_invite_by_token(token)
        if not invite:
            raise ValueError("Invalid onboarding token. The link may be incorrect or removed.")
        
        status = str(invite.get('status') or '').strip().lower()
        if status == 'completed':
            raise ValueError("This onboarding link has already been completed.")
        elif status == 'revoked':
            raise ValueError("This onboarding invite has been revoked by HR.")
        elif status != 'pending':
            raise ValueError(f"This onboarding link is no longer active (status: {invite.get('status')}).")
            
        # Parse expiry
        expires_at = invite.get('expires_at')
        if expires_at:
            if isinstance(expires_at, str):
                for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d'):
                    try:
                        expires_at = datetime.strptime(expires_at, fmt)
                        break
                    except ValueError:
                        continue
            if isinstance(expires_at, datetime):
                if expires_at.tzinfo is not None:
                    from datetime import timezone
                    now = datetime.now(timezone.utc)
                else:
                    now = datetime.now()
                if now > expires_at:
                    raise ValueError("This onboarding link has expired. Please contact HR for a new link.")
             
        return {
            "valid": True,
            "email": invite['email'],
            "name": invite['name'],
            "first_name": invite.get('first_name'),
            "middle_name": invite.get('middle_name'),
            "last_name": invite.get('last_name'),
            "role": invite['role'],
            "department": invite['department'],
            "designation": invite['designation']
        }

    def complete_onboarding(self, token: str, password: str, employee_data: dict, file_metadata: dict):
        invite = self.repo.get_invite_by_token(token)
        if not invite:
            raise ValueError("Invalid onboarding token. The link may be incorrect or removed.")
        
        status = str(invite.get('status') or '').strip().lower()
        if status == 'completed':
            raise ValueError("This onboarding link has already been completed.")
        elif status == 'revoked':
            raise ValueError("This onboarding invite has been revoked by HR.")
        elif status != 'pending':
            raise ValueError(f"This onboarding link is no longer active (status: {invite.get('status')}).")
        
        tenant_id = invite.get('tenant_id', 'public')

        # Age check - OPTIONAL (already optional with try/except)
        # try:
        #     dob = datetime.strptime(employee_data['dob'], '%Y-%m-%d')
        #     age = (datetime.now() - dob).days // 365
        #     if age < 18:
        #         raise ValueError("Neural contract requires minimum age of 18")
        # except:
        #     pass # ignore parse errors if they happen, repo will handle bad data

        # Password validation - REMOVED
        # if len(password) < 8:
        #     raise ValueError("Access Key must be at least 8 segments (characters)")

        # 1. Check for rehire and determine Employee Code
        from backend.modules.deploy.repositories.employee_repo import EmployeeRepository
        existing_emp = EmployeeRepository().get_employee_by_email(invite['email'], tenant_id)
        
        is_rehire = False
        emp_code = ""
        
        if existing_emp:
            # If the employee record already exists (Exited, Pending Approval, or even Active),
            # we must UPDATE their profile rather than INSERT to avoid unique_email_id constraint violation.
            is_rehire = True
            emp_code = existing_emp['employee_code']
        elif invite.get('employee_code') and not self.repo.check_employee_code_exists(invite['employee_code'], tenant_id=tenant_id):
            # Use the employee code HR specified at invite time, if it's still available
            emp_code = invite['employee_code']
        else:
            count = self.repo.generate_employee_code(tenant_id=tenant_id)
            for i in range(100):
                candidate = f"EMP{str(count + i).zfill(4)}"
                if not self.repo.check_employee_code_exists(candidate, tenant_id=tenant_id):
                    emp_code = candidate
                    break

            if not emp_code:
                import random
                emp_code = f"EMP{str(random.randint(1000, 9999))}"

        # 2. Prepare Data
        password_hash = pbkdf2_sha256.hash(password)
        
        user_data = {
            "email": invite['email'],
            "password_hash": password_hash,
            "role": invite['role'],
            "employee_code": emp_code
        }
        
        emp_record = {
            "code": emp_code,
            "name": invite['name'],
            "first_name": invite.get('first_name'),
            "middle_name": invite.get('middle_name'),
            "last_name": invite.get('last_name'),
            "guardian_name": invite.get('guardian_name'),
            "email": invite['email'],
            "phone": employee_data['contact_number'],
            "emergency": employee_data.get('emergency_contact'),
            "dob": employee_data['dob'],
            "current_address": employee_data['current_address'],
            "permanent_address": employee_data['permanent_address'],
            "education": employee_data.get('education_details'),
            "team": invite['department'],
            "designation": invite['designation'],
            "doj": invite.get('doj') or employee_data.get('doj') or datetime.now().strftime('%Y-%m-%d'),
            "location": employee_data.get('location', ''),
            "photo_path": file_metadata.get('photo', ''),
            "cv_path": file_metadata.get('cv', ''),
            "id_proof_path": file_metadata.get('id_proof', ''),
            "passbook_path": file_metadata.get('passbook', ''),
            "bank_name": employee_data.get('bank_name'),
            "bank_account_no": employee_data.get('bank_account_no'),
            "pan_no": employee_data.get('pan_no'),
            "ifsc_code": employee_data.get('ifsc_code')
        }
        
        skill_record = {
            "code": emp_code,
            "name": invite['name'],
            "primary": employee_data.get('primary_skills'),
            "secondary": employee_data.get('secondary_skills'),
            "cv_path": file_metadata.get('cv', '')
        }
        
        # 3. Transaction
        self.repo.complete_onboarding_transaction(user_data, emp_record, skill_record, is_rehire=is_rehire, tenant_id=tenant_id)
        
        # 4. Close Invite
        self.repo.update_invite_status(token, 'Completed')
        
        # 5. Notify Admins for Approval
        # Note: add_notification currently doesn't take tenant_id, might need update
        add_notification(
            title="Onboarding Completed",
            message=f"{invite['name']} has completed onboarding and is awaiting approval for ID {user_data['employee_code']}.",
            n_type="AdminAlert",
            tenant_id=tenant_id
        )
        

        return {"success": True, "message": "Onboarding completed successfully. Please login."}

    def get_pending_approvals(self, tenant_id: str = 'public'):
        return self.repo.get_pending_approvals(tenant_id=tenant_id)

    def reject_pending_approval(self, employee_code: str, tenant_id: str = 'public'):
        email = self.repo.reject_pending_approval(employee_code, tenant_id=tenant_id)
        if not email:
            raise ValueError("Pending approval not found")
        return {"success": True, "message": "Profile rejected and invite revoked."}

    # Fields that must be filled in before an account can be activated from
    # Pending Approvals. Checked against the persisted employee record (not
    # the activation form payload) since these are edited via the "Save
    # Changes" profile editor, not the activation form itself. Bank details
    # are not required — accounts can be activated without them.
    MANDATORY_ACTIVATION_FIELDS = {
        'first_name': 'First Name',
        'last_name': 'Last Name',
        'email_id': 'Email',
        'role': 'Access Role',
        'dob': 'Date of Birth',
        'contact_number': 'Contact Number',
        'current_address': 'Current Address',
    }

    def approve_onboarding(self, employee_code: str, approval_data: dict, tenant_id: str = 'public'):
        from backend.modules.deploy.repositories.employee_repo import EmployeeRepository
        employee = EmployeeRepository().get_employee_by_code(employee_code, tenant_id=tenant_id)
        if not employee:
            raise ValueError("Employee not found")
        for field, label in self.MANDATORY_ACTIVATION_FIELDS.items():
            if not str(employee.get(field) or '').strip():
                raise ValueError(f"{label} is required before this account can be activated.")

        final_code = self.repo.approve_employee(employee_code, approval_data, tenant_id=tenant_id)
        final_code = final_code or employee_code

        # Initialize Asset Checklist
        from backend.modules.deploy.repositories.asset_repo import AssetRepository
        try:
            default_assets = {
                'ob_pf': 1 if approval_data.get('pf') in ['Yes', 'true', '1'] else 0,
                'ob_mediclaim': 1 if approval_data.get('mediclaim') in ['Yes', 'true', '1'] else 0
            }
            AssetRepository().create_asset_checklist(final_code, default_assets, tenant_id)
        except Exception as e:
            print("Failed to initialize assets on approve:", e)

        # Notify the employee that their account is now active
        add_notification(
            title="Account Activated",
            message="Your profile has been reviewed and approved. You now have full access to the platform.",
            employee_code=final_code,
            n_type="Success",
            tenant_id=tenant_id
        )

        return {"success": True, "message": f"Personnel {final_code} identity activated."}

    def approve_section(self, employee_code: str, section: str, tenant_id: str = 'public'):
        res = self.repo.approve_section(employee_code, section, tenant_id=tenant_id)
        if res.get('is_fully_approved'):
            add_notification(
                title="Account Activated",
                message="Your profile has been fully reviewed and approved by HR and Finance. You now have full access to the platform.",
                employee_code=employee_code,
                n_type="Success",
                tenant_id=tenant_id
            )
        return {"success": True, "data": res, "message": f"{section.upper()} sign-off recorded successfully."}

    def unify_admin_identity(self, user_id: int, username: str, emp_data: dict, file_metadata: dict, tenant_id: str = 'public'):
        """
        Completes the first-time setup for an Org Admin.
        Directly creates employee record and links it to user.
        """
        # 1. Generate Employee Code (Admin is always EMP0001 if possible, or first available)
        count = self.repo.generate_employee_code(tenant_id=tenant_id)
        emp_code = f"EMP{str(count).zfill(4)}"
        while self.repo.check_employee_code_exists(emp_code, tenant_id=tenant_id):
            count += 1
            emp_code = f"EMP{str(count).zfill(4)}"

        # 2. Prepare Data
        from backend.core.database import get_db_connection
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}", public')
                
                first_name = emp_data.get('first_name') or username.split('@')[0]
                middle_name = emp_data.get('middle_name')
                last_name = emp_data.get('last_name')
                full_name = join_name_parts(first_name, middle_name, last_name)

                # Insert Employee
                cur.execute("""
                    INSERT INTO employees (
                        employee_code, name, first_name, middle_name, last_name, email_id, contact_number, emergency_contact,
                        dob, current_address, permanent_address, team, designation,
                        employment_status, location, photo_path, cv_path, id_proofs, doj,
                        employment_type, education_details, bank_name, bank_account_no,
                        pan_no, pf_included, mediclaim_included
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    emp_code, full_name, first_name, middle_name, last_name, username,
                    emp_data['contact_number'], emp_data['emergency_contact'], emp_data['dob'],
                    emp_data['current_address'], emp_data['permanent_address'],
                    "Executive", "Organization Admin", "Active", emp_data.get('location', ''),
                    file_metadata.get('photo', ''), file_metadata.get('cv', ''),
                    file_metadata.get('id_proof', ''), datetime.now().strftime('%Y-%m-%d'),
                    'Full Time', emp_data.get('education_details', '[]'),
                    emp_data.get('bank_name'), emp_data.get('bank_account_no'),
                    emp_data.get('pan_no'), emp_data.get('pf_included', 'No'),
                    emp_data.get('mediclaim_included', 'No')
                ))

                # Insert Skill Matrix (Notice the correct column names found in schema check)
                cur.execute("""
                    INSERT INTO skill_matrix (
                        employee_code, candidate_name, primary_skillset,
                        secondary_skillset, cv_upload, experience_years
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    emp_code, full_name,
                    emp_data.get('primary_skills', ''), emp_data.get('secondary_skills', ''),
                    file_metadata.get('cv', ''), '0'
                ))

                # Link User to Employee Code
                cur.execute("UPDATE users SET employee_code = %s WHERE id = %s", (emp_code, user_id))
                conn.commit()
                
            return {"success": True, "employee_code": emp_code}
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()