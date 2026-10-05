from datetime import datetime, timedelta, timezone
import calendar
from typing import List, Dict, Any, Optional
from backend.modules.deploy.repositories.attendance_repo import AttendanceRepository
from backend.modules.deploy.repositories.holiday_repo import HolidayRepository
from backend.modules.deploy.services.notification_service import add_notification
from backend.modules.deploy.schemas.attendance import (
    ClockOutRequest, AttendanceStatus, LeaveBalance, LeaveRequest, EditAttendanceRequest
)

# Always use IST (UTC+5:30) for business-date calculations so that the
# server's physical timezone (e.g. Frankfurt UTC+2) never leaks into logic.
_IST = timezone(timedelta(hours=5, minutes=30))

def _today_utc():
    """Fallback: return today in UTC when no client date is available."""
    return datetime.utcnow().date()

def _today_ist():
    """Return today in IST timezone."""
    return datetime.now(_IST).date()

def compute_shift_duration_and_status(clock_in: Optional[str], clock_out: Optional[str],
                                      shift_date: Optional[str] = None,
                                      clock_out_date: Optional[str] = None) -> tuple:
    """
    Computes duration in hours and attendance status, supporting cross-midnight/overnight shifts.
    Returns (duration_hours, status).
    """
    if not clock_in or not clock_out:
        if clock_in:
            return 0.0, 'Active'
        return 0.0, 'Absent'

    try:
        str_in = str(clock_in).strip()
        str_out = str(clock_out).strip()
        fmt_in = '%H:%M:%S' if len(str_in) == 8 else '%H:%M'
        fmt_out = '%H:%M:%S' if len(str_out) == 8 else '%H:%M'
        
        t_in = datetime.strptime(str_in, fmt_in)
        t_out = datetime.strptime(str_out, fmt_out)

        if shift_date and clock_out_date:
            d_in = datetime.strptime(str(shift_date).strip(), '%Y-%m-%d').date()
            d_out = datetime.strptime(str(clock_out_date).strip(), '%Y-%m-%d').date()
            dt_in = datetime.combine(d_in, t_in.time())
            dt_out = datetime.combine(d_out, t_out.time())
            duration_hours = (dt_out - dt_in).total_seconds() / 3600.0
        else:
            if t_out < t_in:
                duration_hours = ((t_out + timedelta(days=1)) - t_in).total_seconds() / 3600.0
            else:
                duration_hours = (t_out - t_in).total_seconds() / 3600.0

        if duration_hours >= 8.0:
            status = 'Present'
        elif duration_hours >= 4.0:
            if t_in.hour < 13:
                status = 'Half Day (First Half)'
            else:
                status = 'Half Day (Second Half)'
        else:
            status = 'Absent'

        return max(0.0, duration_hours), status
    except Exception:
        return 0.0, 'Present'


class AttendanceService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = AttendanceRepository()
        self.holiday_repo = HolidayRepository()
        self.tenant_id = tenant_id

    def get_status(self, employee_code: str) -> AttendanceStatus:
        today = datetime.now(_IST).strftime('%Y-%m-%d')

        # 1. Check if there's an ongoing active shift (could have started yesterday or today)
        active_records = self.repo.get_history(employee_code, limit=1, tenant_id=self.tenant_id)
        if active_records and active_records[0].get('status') == 'Active' and not active_records[0].get('clock_out'):
            rec = active_records[0]
            try:
                rec_date = rec['date']
                rec_in = rec.get('clock_in', '00:00:00')
                fmt = '%Y-%m-%d %H:%M:%S' if len(rec_in) == 8 else '%Y-%m-%d %H:%M'
                dt_in = datetime.strptime(f"{rec_date} {rec_in}", fmt)
                now_dt = datetime.now(_IST).replace(tzinfo=None)
                if (now_dt - dt_in).total_seconds() <= 20 * 3600:
                    return AttendanceStatus(status="clocked_in", data=rec)
            except Exception:
                return AttendanceStatus(status="clocked_in", data=rec)

        # 2. Check today's record
        record = self.repo.get_todays_attendance(employee_code, today, self.tenant_id)
        
        if not record:
            return AttendanceStatus(status="not_started", data=None)
        
        if record.get('clock_out'):
             return AttendanceStatus(status="completed", data=record)
        else:
             return AttendanceStatus(status="clocked_in", data=record)

    def clock_in(self, employee_code: str, ip_address: str, local_date: Optional[str] = None, local_time: Optional[str] = None):
        today = local_date if local_date else datetime.now(_IST).strftime('%Y-%m-%d')
        now = local_time if local_time else datetime.now(_IST).strftime('%H:%M:%S')
        
        # Check if employee has an open active shift
        active_records = self.repo.get_history(employee_code, limit=1, tenant_id=self.tenant_id)
        if active_records and active_records[0].get('status') == 'Active' and not active_records[0].get('clock_out'):
            rec = active_records[0]
            try:
                rec_in = rec.get('clock_in', '00:00:00')
                fmt = '%Y-%m-%d %H:%M:%S' if len(rec_in) == 8 else '%Y-%m-%d %H:%M'
                dt_in = datetime.strptime(f"{rec['date']} {rec_in}", fmt)
                now_dt = datetime.now(_IST).replace(tzinfo=None)
                if (now_dt - dt_in).total_seconds() <= 20 * 3600:
                    raise ValueError(f"You already have an active shift clocked in on {rec['date']} at {rec['clock_in']}. Please clock out first.")
            except ValueError:
                raise
            except Exception:
                raise ValueError("You are already clocked in for an active shift. Please clock out first.")

        existing = self.repo.get_todays_attendance(employee_code, today, self.tenant_id)
        if existing:
            raise ValueError("Already clocked in for today")
            
        self.repo.clock_in(employee_code, today, now, ip_address, self.tenant_id)
        return {"success": True, "message": "Clocked in successfully", "time": now}

    def clock_out(self, employee_code: str, data: ClockOutRequest):
        today = data.local_date if data.local_date else datetime.now(_IST).strftime('%Y-%m-%d')
        now = data.local_time if data.local_time else datetime.now(_IST).strftime('%H:%M:%S')
        
        active_records = self.repo.get_history(employee_code, limit=1, tenant_id=self.tenant_id)
        if not active_records or active_records[0].get('status') != 'Active':
             raise ValueError("No active attendance record found. Please clock in first.")
             
        record = active_records[0]
        
        if record.get('clock_out'):
             raise ValueError("Already clocked out.")

        clock_in_str = record.get('clock_in', '00:00:00')
        fmt_in = '%Y-%m-%d %H:%M:%S' if len(clock_in_str) == 8 else '%Y-%m-%d %H:%M'
        fmt_out = '%Y-%m-%d %H:%M:%S' if len(now) == 8 else '%Y-%m-%d %H:%M'
        
        try:
            dt_in = datetime.strptime(f"{record['date']} {clock_in_str}", fmt_in)
            dt_out = datetime.strptime(f"{today} {now}", fmt_out)
        except Exception:
            raise ValueError("Invalid date or time format.")

        elapsed_seconds = (dt_out - dt_in).total_seconds()
        
        if elapsed_seconds < 0:
            raise ValueError("Clock-out time cannot be earlier than clock-in time.")

        if elapsed_seconds > 20 * 3600:
            raise ValueError("Shift duration exceeds 20 hours. Please contact your administrator to regularize this record.")

        duration_hours, status = compute_shift_duration_and_status(
            clock_in=record['clock_in'],
            clock_out=now,
            shift_date=record['date'],
            clock_out_date=today
        )

        self.repo.clock_out(employee_code, record['date'], now, data.work_log, self.tenant_id, clock_out_date=today, status=status)
        return {"success": True, "message": "Clocked out successfully", "duration_hours": round(duration_hours, 2), "status": status}

    def get_history(self, employee_code: str):
        # 1. Fetch Attendance History
        history = self.repo.get_history(employee_code, tenant_id=self.tenant_id)
        for log in history:
            clock_in = log.get('clock_in')
            clock_out = log.get('clock_out')
            shift_date = log.get('date')
            clock_out_date = log.get('clock_out_date')
            
            if clock_in and clock_out:
                _, status = compute_shift_duration_and_status(clock_in, clock_out, shift_date, clock_out_date)
                log['status'] = status
            elif clock_in:
                today_str = datetime.now(_IST).strftime('%Y-%m-%d')
                yesterday_str = (datetime.now(_IST) - timedelta(days=1)).strftime('%Y-%m-%d')
                is_active = False
                if log['date'] == today_str:
                    is_active = True
                elif log['date'] == yesterday_str:
                    try:
                        dt_in = datetime.strptime(f"{log['date']} {clock_in}", '%Y-%m-%d %H:%M:%S' if len(clock_in) == 8 else '%Y-%m-%d %H:%M')
                        now_dt = datetime.now(_IST).replace(tzinfo=None)
                        if (now_dt - dt_in).total_seconds() <= 16 * 3600:
                            is_active = True
                    except Exception:
                        pass
                
                log['status'] = 'Active' if is_active else 'Absent'
            else:
                log['status'] = 'Absent'

        # 2. Fetch and Merge Approved Leaves
        leaves = self.repo.get_employee_leaves(employee_code, self.tenant_id)
        for l in leaves:
            if l['status'] == 'Approved':
                # Note: This simple merge adds leave records to the list. 
                # In a more advanced view, we might merge them by date.
                history.append({
                    "date": l['start_date'],
                    "clock_in": "00:00:00",
                    "clock_out": "00:00:00",
                    "status": "Leave",
                    "work_log": f"Approved Leave: {l['reason']}"
                })
        
        # Re-sort by date
        history.sort(key=lambda x: x['date'], reverse=True)
        return history[:30]

    def get_leave_balance(self, employee_code: str) -> Dict[str, Any]:
        year = datetime.now(_IST).year
        balance = self.repo.get_leave_balance(employee_code, year, self.tenant_id)
        
        if not balance:
            self.repo.create_leave_balance(employee_code, year, self.tenant_id)
            balance = self.repo.get_leave_balance(employee_code, year, self.tenant_id)
            
        return balance

    def apply_leave(self, employee_code: str, req: LeaveRequest, user_role: str = 'Employee'):
        # 1. Date Validation
        try:
            d1 = datetime.strptime(req.start_date, '%Y-%m-%d')
            d2 = datetime.strptime(req.end_date, '%Y-%m-%d')
        except ValueError:
            raise ValueError("Invalid date format. Must be YYYY-MM-DD.")
            
        if d2 < d1:
            raise ValueError("End date cannot be earlier than the start date.")
            
        # Check for overlaps
        if self.repo.check_overlapping_leaves(employee_code, req.start_date, req.end_date, self.tenant_id):
            raise ValueError("Leave dates overlap with an existing leave request.")
            

        # Fetch declared company holidays in range
        holidays = self.holiday_repo.get_holidays_in_range(req.start_date, req.end_date, self.tenant_id)
        holiday_dates = {h['date']: h for h in holidays}

        # Calculate working days (exclude weekends and full holidays)
        curr = d1
        days = 0.0
        while curr <= d2:
            d_str = curr.strftime('%Y-%m-%d')
            is_weekend = curr.weekday() >= 5
            is_holiday = d_str in holiday_dates

            if not is_weekend and not is_holiday:
                if d1 == d2:
                    if req.start_day_type in ["First Half", "Second Half"]:
                        days += 0.5
                    else:
                        days += 1.0
                else:
                    day_val = 1.0
                    if curr == d1 and req.start_day_type == "Second Half":
                        day_val = 0.5
                    elif curr == d2 and req.end_day_type == "First Half":
                        day_val = 0.5
                    days += day_val
            elif is_holiday and holiday_dates[d_str].get('is_half_day'):
                # Half-day holiday only discounts half a day
                days += 0.5
            curr += timedelta(days=1)

        if days < 0:
            days = 0.0
        
        # 2. Status Determination
        status = 'Approved' if user_role == 'super_admin' else 'Pending'
        msg = "Leave auto-approved (Admin override)" if status == 'Approved' else "Leave application submitted successfully"
        
        # 3. Create Request
        self.repo.create_leave_request(employee_code, req.start_date, req.end_date, days, req.start_day_type, req.end_day_type, req.leave_type, req.reason, status, self.tenant_id)
        
        # 4. Immediate Balance Update for Admin
        if status == 'Approved':
            balance = self.get_leave_balance(employee_code)
            available = max(0, balance['total_leaves'] - balance['used_leaves'])
            used_delta = min(days, available)
            extended_delta = max(0, days - available)
            self.repo.update_leave_balance(employee_code, used_delta, extended_delta, self.tenant_id)
        else:
            add_notification(
                title="New Leave Request",
                message=f"Employee {employee_code} has applied for {days} days of leave.",
                n_type="AdminAlert",
                tenant_id=self.tenant_id
            )
            # Confirm submission back to the employee
            add_notification(
                title="Leave Request Submitted",
                message=f"Your {req.leave_type} leave request from {req.start_date} to {req.end_date} ({days} day(s)) has been submitted and is pending approval.",
                employee_code=employee_code,
                n_type="Info",
                tenant_id=self.tenant_id
            )

        return {"success": True, "message": msg}

    def get_my_leaves(self, employee_code: str):
        return self.repo.get_employee_leaves(employee_code, self.tenant_id)

    def get_all_pending_leaves(self, role: str, employee_code: Optional[str] = None):
        if role == 'employee':
            if employee_code and self.repo.is_reporting_manager(employee_code, self.tenant_id):
                role = 'manager'
            else:
                leaves = self.repo.get_all_pending_leaves(None, None, self.tenant_id)
                return [l for l in leaves if l['employee_code'] == employee_code]
                
        admin_code = employee_code if role == 'manager' else None
        return self.repo.get_all_pending_leaves(role, admin_code, self.tenant_id)

    def get_daily_log(self, date_str: Optional[str] = None, role: str = 'employee', employee_code: Optional[str] = None):
        if date_str is None:
            date_str = datetime.now(_IST).strftime('%Y-%m-%d')
            
        if role == 'employee':
            if employee_code and self.repo.is_reporting_manager(employee_code, self.tenant_id):
                role = 'manager'
            else:
                return []
            
        # For manager, filter by reporting manager code
        manager_code = employee_code if role == 'manager' else None
        
        return self.repo.get_daily_log(date_str, manager_code, self.tenant_id)

    def approve_reject_leave(self, leave_id: int, action: str, reason: Optional[str], admin_role: str, admin_code: Optional[str]):
        leave = self.repo.get_leave_by_id(leave_id, self.tenant_id)
        if not leave:
            raise ValueError("Leave request not found")

        # 1. Prevent Self-Approval
        if admin_code and leave['employee_code'] == admin_code:
            raise ValueError("You cannot approve your own leave request.")

        # 2. Hierarchy Check
        applicant_role = self.repo.get_user_role(leave['employee_code'], self.tenant_id)
        
        # If the admin is their direct manager, they can approve it regardless of role
        is_direct_manager = (admin_code and self.repo.get_manager_code(leave['employee_code'], self.tenant_id) == admin_code)
        
        if not is_direct_manager and applicant_role in ['org_admin', 'manager'] and admin_role not in ['org_admin', 'super_admin']:
             raise ValueError("Administrative leave requests can only be approved by an Organization Admin.")

        self.repo.update_leave_status(leave_id, action, reason, self.tenant_id)
        
        if action == 'Approved':
            # Use duration_days directly
            days = float(leave.get('duration_days') or 0.0)

            # Calculate and Apply Balance Logic
            balance = self.get_leave_balance(leave['employee_code'])
            available = max(0, balance['total_leaves'] - balance['used_leaves'])
            used_delta = min(days, available)
            extended_delta = max(0, days - available)
            
            self.repo.update_leave_balance(leave['employee_code'], used_delta, extended_delta, self.tenant_id)
            
            # Auto-cancel pending corrections for leave dates
            try:
                d1 = datetime.strptime(leave['start_date'], '%Y-%m-%d')
                d2 = datetime.strptime(leave['end_date'], '%Y-%m-%d')
                curr = d1
                while curr <= d2:
                    d_str = curr.strftime('%Y-%m-%d')
                    correction = self.repo.get_pending_correction_for_date(leave['employee_code'], d_str, self.tenant_id)
                    if correction:
                        self.repo.update_correction_request_status(
                            correction['id'],
                            'Cancelled',
                            admin_code,
                            'Superseded by approved leave',
                            self.tenant_id
                        )
                    curr += timedelta(days=1)
            except Exception:
                pass
        
        # Mark the original request notification as read
        from backend.modules.deploy.services.notification_service import NotificationService
        notif_service = NotificationService()
        notif_service.mark_relevant_as_read("New Leave Request", leave['employee_code'])

        # Notify user about the decision
        add_notification(
            title=f"Leave {action}",
            message=f"Your {leave['leave_type']} leave request for {leave['start_date']} to {leave['end_date']} has been {action.lower()}.",
            employee_code=leave['employee_code'],
            n_type="Success" if action == 'Approved' else "Alert",
            tenant_id=self.tenant_id
        )

        return {"success": True, "message": f"Leave has been {action}"}

    def get_monthly_summary(self, year: int, month: int, manager_code: Optional[str] = None):
        employees = self.repo.get_all_active_employees_basic(self.tenant_id, manager_code)
        
        num_days = calendar.monthrange(year, month)[1]
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year}-{month:02d}-{num_days}"
        
        attendance_rows = self.repo.get_monthly_attendance(start_date, end_date, self.tenant_id)
        leave_rows = self.repo.get_monthly_approved_leaves(start_date, end_date, self.tenant_id)
        holiday_rows = self.holiday_repo.get_holidays_in_range(start_date, end_date, self.tenant_id)
        holidays_map = {h['date']: h for h in holiday_rows}
        
        # Process maps
        att_map = {}
        for row in attendance_rows:
            # Ensure code and date are normalized
            e_code = row['employee_code']
            if e_code not in att_map: att_map[e_code] = {}
            
            # Normalize date to string for robust matching
            d_val = row['date']
            d_str = d_val.strftime('%Y-%m-%d') if hasattr(d_val, 'strftime') else str(d_val)
            
            clock_in = row.get('clock_in')
            clock_out = row.get('clock_out')
            
            if clock_in and clock_out:
                _, status = compute_shift_duration_and_status(
                    clock_in, clock_out, d_str, row.get('clock_out_date')
                )
                att_map[e_code][d_str] = status
            elif clock_in:
                today_str = datetime.now(_IST).strftime('%Y-%m-%d')
                yesterday_str = (datetime.now(_IST) - timedelta(days=1)).strftime('%Y-%m-%d')
                is_active = False
                if d_str == today_str:
                    is_active = True
                elif d_str == yesterday_str:
                    try:
                        dt_in = datetime.strptime(f"{d_str} {clock_in}", '%Y-%m-%d %H:%M:%S' if len(str(clock_in)) == 8 else '%Y-%m-%d %H:%M')
                        now_dt = datetime.now(_IST).replace(tzinfo=None)
                        if (now_dt - dt_in).total_seconds() <= 16 * 3600:
                            is_active = True
                    except Exception:
                        pass
                att_map[e_code][d_str] = 'Active' if is_active else 'Absent'
            else:
                 att_map[e_code][d_str] = 'Absent'
        leave_map = {}
        for row in leave_rows:
            code = row['employee_code']
            if code not in leave_map: leave_map[code] = {}
            
            try:
                d1 = datetime.strptime(row['start_date'], '%Y-%m-%d')
                d2 = datetime.strptime(row['end_date'], '%Y-%m-%d')
                
                month_start = datetime(year, month, 1)
                month_end = datetime(year, month, num_days)
                
                curr = max(d1, month_start)
                end = min(d2, month_end)
                
                while curr <= end:
                    d_str = curr.strftime('%Y-%m-%d')
                    l_status = 'Leave'
                    if curr == d1 and row.get('start_day_type') in ['First Half', 'Second Half']:
                        l_status = f"Half Day Leave ({row.get('start_day_type')})"
                    if curr == d2 and row.get('end_day_type') in ['First Half', 'Second Half']:
                        l_status = f"Half Day Leave ({row.get('end_day_type')})"
                    
                    leave_map[code][d_str] = l_status
                    curr += timedelta(days=1)
            except:
                pass

        summary = []
        for emp in employees:
            code = emp['employee_code']
            days = []
            present_count = 0
            half_day_count = 0
            leave_count = 0
            absent_count = 0
            holiday_count = 0
            
            for day in range(1, num_days + 1):
                date_str = f"{year}-{month:02d}-{day:02d}"
                status = 'Absent'
                
                if code in leave_map and date_str in leave_map[code]:
                    status = leave_map[code][date_str]
                    if status == 'Leave':
                        leave_count += 1
                    else:
                        leave_count += 0.5
                elif code in att_map and date_str in att_map[code]:
                    status = att_map[code][date_str]
                    if status == 'Present' or status == 'Active':
                        present_count += 1
                    elif status.startswith('Half Day'):
                        half_day_count += 1
                    elif status == 'Absent':
                        absent_count += 1
                elif date_str in holidays_map:
                    status = 'Holiday'
                    holiday_count += 1
                else:
                    try:
                        dt = datetime(year, month, day)
                        dt_date = dt.date()
                        today_date = _today_ist()
                        
                        if dt.weekday() >= 5: 
                            status = 'Weekend'
                        elif dt_date > today_date:
                            status = 'Future'
                        elif dt_date == today_date:
                            status = 'Not Started' 
                        else:
                            status = 'Absent'
                            absent_count += 1
                    except:
                        pass
                
                h_name = holidays_map[date_str]['name'] if date_str in holidays_map else None
                days.append({"day": day, "status": status, "date": date_str, "holiday_name": h_name})

            summary.append({
                "name": emp['name'],
                "code": code,
                "days": days,
                "stats": {"present": present_count, "half_day": half_day_count, "leave": leave_count, "absent": absent_count, "holiday": holiday_count}
            })
            
        return summary

    def get_active_employees(self, manager_code: Optional[str] = None):
        return self.repo.get_all_active_employees_basic(self.tenant_id, manager_code)

    def get_history_for_employee(self, employee_code: str, limit: int = 90, manager_code: Optional[str] = None):
        """Admin/Manager: retrieve full attendance history for a given employee."""
        if manager_code and self.repo.get_manager_code(employee_code, self.tenant_id) != manager_code:
            raise ValueError("Unauthorized to view this employee's history")
        return self.repo.get_history(employee_code, limit, self.tenant_id)

    def get_leaves_for_employee(self, employee_code: str, manager_code: Optional[str] = None):
        """Admin/Manager: retrieve all leaves for a given employee."""
        if manager_code and self.repo.get_manager_code(employee_code, self.tenant_id) != manager_code:
            raise ValueError("Unauthorized to view this employee's leaves")
        return self.repo.get_employee_leaves(employee_code, self.tenant_id)


    def edit_attendance(self, req: EditAttendanceRequest):
        # 1. Determine Status based on duration
        clock_out_date = req.clock_out_date
        if req.clock_in and req.clock_out:
            if not clock_out_date and req.clock_out < req.clock_in:
                try:
                    d_obj = datetime.strptime(req.date, '%Y-%m-%d').date()
                    clock_out_date = (d_obj + timedelta(days=1)).strftime('%Y-%m-%d')
                except Exception:
                    clock_out_date = req.date
            _, status = compute_shift_duration_and_status(req.clock_in, req.clock_out, req.date, clock_out_date)
        elif req.clock_in:
            today_str = datetime.now(_IST).strftime('%Y-%m-%d')
            status = 'Active' if req.date == today_str else 'Absent'
        else:
            status = 'Absent'
        
        # 2. Update via Repo
        self.repo.upsert_attendance(
            req.employee_code, 
            req.date, 
            req.clock_in, 
            req.clock_out, 
            req.work_log, 
            status, 
            self.tenant_id,
            clock_out_date=clock_out_date
        )
        # Notify the affected employee that their record was modified
        add_notification(
            title="Attendance Record Updated",
            message=f"Your attendance record for {req.date} has been updated by admin (status: {status}).",
            employee_code=req.employee_code,
            n_type="Info",
            tenant_id=self.tenant_id
        )
        return {"success": True, "message": "Attendance record synchronized", "status": status}

    def check_and_trigger_missed_clockout_reminders(self) -> Dict[str, Any]:
        """
        Scans unclosed records, marks past records as Absent, and triggers reminder emails/notifications.
        """
        import pytz
        from backend.core.database import get_db_connection
        
        # Get tenant timezone
        tz_name = 'Asia/Kolkata'
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT timezone FROM public.tenants WHERE id = %s", (self.tenant_id,))
            row = cur.fetchone()
            if row and row[0]:
                tz_name = row[0]
        except Exception:
            pass
        finally:
            conn.close()
            
        tz = pytz.timezone(tz_name)
        now_utc = datetime.utcnow().replace(tzinfo=pytz.utc)
        now_local = now_utc.astimezone(tz)
        current_date_str = now_local.strftime('%Y-%m-%d')
        
        # 1. Update status to Absent for past missed clock-outs older than 16 hours
        cutoff_dt = now_local - timedelta(hours=16)
        cutoff_date = cutoff_dt.strftime('%Y-%m-%d')
        cutoff_time = cutoff_dt.strftime('%H:%M:%S')
        self.repo.mark_past_missed_clockouts_as_absent(cutoff_date, self.tenant_id, cutoff_time=cutoff_time)
        
        # 2. Retrieve unclosed records
        unclosed = self.repo.get_unclosed_attendance_records(self.tenant_id)
        reminders_sent = 0
        
        for record in unclosed:
            try:
                # Combining date and clock_in
                clockin_dt_naive = datetime.strptime(f"{record['date']} {record['clock_in']}", "%Y-%m-%d %H:%M:%S")
            except Exception:
                try:
                    # In case clock_in is HH:MM
                    clockin_dt_naive = datetime.strptime(f"{record['date']} {record['clock_in']}", "%Y-%m-%d %H:%M")
                except Exception:
                    continue
            
            # Make clockin_dt timezone aware
            clockin_dt = tz.localize(clockin_dt_naive)
                
            elapsed_hours = (now_local - clockin_dt).total_seconds() / 3600.0
            
            if elapsed_hours >= 12.0:
                reminder_log = self.repo.get_attendance_reminder(record['id'], self.tenant_id)
                should_send = False
                
                if not reminder_log:
                    should_send = True
                else:
                    last_sent = reminder_log['last_reminder_sent']
                    if last_sent.tzinfo is None:
                        # Assuming last_sent in DB is local time without tz info, or UTC. 
                        # Actually postgres TIMESTAMP is typically returned as naive datetime. 
                        # Let's assume it was stored as local time.
                        last_sent = tz.localize(last_sent)
                    else:
                        last_sent = last_sent.astimezone(tz)
                    
                    hours_since_last = (now_local - last_sent).total_seconds() / 3600.0
                    if hours_since_last >= 12.0:
                        should_send = True
                        
                if should_send:
                    to_email = record.get('employee_email')
                    emp_name = record.get('employee_name')
                    clockin_time = record.get('clock_in')
                    att_date = record.get('date')
                    
                    if to_email:
                        from backend.core.email_service_extended import send_clockout_reminder_email
                        import os
                        company = os.getenv("COMPANY_NAME", self.tenant_id)
                        try:
                            send_clockout_reminder_email(to_email, emp_name, str(clockin_time), str(att_date), company_name=company)
                        except Exception as mail_err:
                            logger.warning(f"Clockout reminder email failed for {record.get('employee_code')} (non-blocking): {mail_err}")
                        
                    # Trigger in-app notification
                    add_notification(
                        title="Missed Clock-Out",
                        message=f"You forgot to clock out on {att_date}. Please submit a correction request.",
                        employee_code=record['employee_code'],
                        n_type="Alert",
                        tenant_id=self.tenant_id
                    )
                    
                    self.repo.upsert_attendance_reminder(record['id'], record['employee_code'], now_local.replace(tzinfo=None), self.tenant_id)
                    reminders_sent += 1
                        
        return {
            "success": True,
            "message": f"Processed missed clock-outs. Sent {reminders_sent} reminders."
        }

    # ─── Two-Track Correction Service Methods ────────────────────────────────

    @staticmethod
    def _is_self_service_date(target_date, today) -> bool:
        """
        Returns True if `target_date` is within its self-service correction window.

        Window rule: Both the current week (Mon-Sun) and the entire previous week can be self-corrected/logged.
        Dates older than the previous Monday require manager approval.
        """
        from datetime import date as date_type
        if isinstance(target_date, str):
            target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
        if isinstance(today, str):
            today = datetime.strptime(today, '%Y-%m-%d').date()

        if target_date > today:   # Can't record for future dates
            return False

        # The self-service window covers the entire current week and previous week (starting from previous week's Monday)
        this_monday = today - timedelta(days=today.weekday())
        previous_monday = this_monday - timedelta(days=7)
        return target_date >= previous_monday

    def get_correction_window(self, employee_code: str, client_date: str = None) -> Dict[str, Any]:
        """
        Returns the list of days visible in the correction UI.
        Shows: current week + previous week (14 days back from this Monday).
        Each day is tagged with: status, clock-in/out, track, and any pending correction.
        """
        # Use client-supplied date if provided (employee's local date),
        # else fall back to UTC (avoids server-timezone bugs for global teams).
        if client_date:
            try:
                today = datetime.strptime(client_date, '%Y-%m-%d').date()
            except ValueError:
                today = _today_utc()
        else:
            today = _today_utc()
        today_str = today.strftime('%Y-%m-%d')

        # Look back approx 3 months (12 weeks before this_monday, so 13 weeks total including current)
        this_monday = today - timedelta(days=today.weekday())
        
        doj = self.repo.get_employee_doj(employee_code, self.tenant_id)
        
        WEEKS_BACK = 12
        start_monday = this_monday - timedelta(weeks=WEEKS_BACK)

        # Fetch attendance records, holidays, and approved leaves for the window
        window_start_str = start_monday.strftime('%Y-%m-%d')
        window_end_str = (this_monday + timedelta(days=6)).strftime('%Y-%m-%d')  # next Sunday
        att_records = self.repo.get_attendance_in_range(employee_code, window_start_str, window_end_str, self.tenant_id)
        att_map = {r['date']: r for r in att_records}
        
        holidays_in_window = self.holiday_repo.get_holidays_in_range(window_start_str, window_end_str, self.tenant_id)
        holidays_map = {h['date']: h for h in holidays_in_window}

        # Fetch approved leaves for the employee
        leaves = self.repo.get_employee_leaves(employee_code, self.tenant_id)
        approved_leaves = {}
        for l in leaves:
            if l.get('status') == 'Approved':
                try:
                    ld1 = datetime.strptime(l['start_date'], '%Y-%m-%d').date()
                    ld2 = datetime.strptime(l['end_date'], '%Y-%m-%d').date()
                    curr_l = ld1
                    while curr_l <= ld2:
                        approved_leaves[curr_l.strftime('%Y-%m-%d')] = l
                        curr_l += timedelta(days=1)
                except Exception:
                    continue

        # Fetch pending correction requests in this range
        pending_corrections = self.repo.get_my_corrections(employee_code, self.tenant_id)
        pending_map = {
            c['date']: c for c in pending_corrections
            if c['status'] == 'Pending' and c['date'] >= window_start_str
        }

        weekday_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        days_out = []

        # Build window (start_monday through this Sunday)
        total_days = (WEEKS_BACK + 1) * 7
        for i in range(total_days):
            d = start_monday + timedelta(days=i)
            d_str = d.strftime('%Y-%m-%d')
            att = att_map.get(d_str)
            h_info = holidays_map.get(d_str)
            is_holiday = bool(h_info)
            holiday_name = h_info['name'] if h_info else None
            holiday_type = h_info.get('holiday_type') if h_info else None
            is_half_day = bool(h_info.get('is_half_day')) if h_info else False

            l_info = approved_leaves.get(d_str)
            is_leave = bool(l_info)
            leave_type = l_info.get('leave_type') if l_info else None

            if doj and d < doj:
                track = 'before_join'
            elif d > today:
                track = 'future'
            elif self._is_self_service_date(d, today):
                track = 'self_service'
            else:
                track = 'requested'

            # Compute effective status from attendance record & leaves & holidays
            status = 'Holiday' if is_holiday else ('Leave' if is_leave else 'No Record')
            clock_in = None
            clock_out = None
            work_log = None

            if att:
                clock_in = att.get('clock_in')
                clock_out = att.get('clock_out')
                work_log = att.get('work_log')

                if clock_in and clock_out:
                    _, status = compute_shift_duration_and_status(
                        clock_in, clock_out, d_str, att.get('clock_out_date')
                    )
                elif clock_in:
                    status = 'Active' if d_str == today_str else 'Missing Clock-Out'
                else:
                    if is_leave:
                        status = 'Leave'
                    elif is_holiday:
                        status = 'Holiday'
                    else:
                        status = 'Absent'
            else:
                if is_leave:
                    status = 'Leave'
                elif is_holiday:
                    status = 'Holiday'
                elif d.weekday() >= 5:
                    status = 'Weekend'
                elif d < today:
                    status = 'Absent'
                else:
                    status = 'No Record'

            days_out.append({
                'date': d_str,
                'weekday': weekday_names[d.weekday()],
                'status': status,
                'clock_in': str(clock_in) if clock_in else None,
                'clock_out': str(clock_out) if clock_out else None,
                'work_log': work_log,
                'track': track,
                'pending_correction': pending_map.get(d_str),
                'is_holiday': is_holiday,
                'holiday_name': holiday_name,
                'holiday_type': holiday_type,
                'is_half_day': is_half_day,
                'is_leave': is_leave,
                'leave_type': leave_type
            })

        return {
            'today': today_str,
            'this_monday': this_monday.strftime('%Y-%m-%d'),
            'start_monday': start_monday.strftime('%Y-%m-%d'),
            'days': days_out
        }

    def _compute_attendance_status(self, clock_in: Optional[str], clock_out: Optional[str],
                                   shift_date: Optional[str] = None,
                                   clock_out_date: Optional[str] = None) -> str:
        """Reusable helper to compute attendance status from clock times."""
        _, status = compute_shift_duration_and_status(clock_in, clock_out, shift_date, clock_out_date)
        return status

    def apply_self_service_correction(self, employee_code: str, date_str: str,
                                      clock_in: Optional[str], clock_out: Optional[str],
                                      reason: str, client_date: str = None):
        """
        Employee self-corrects within the open weekly window.
        Immediately upserts the attendance record — no manager approval needed.
        """
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            raise ValueError("Invalid date format. Must be YYYY-MM-DD.")

        if client_date:
            try:
                today = datetime.strptime(client_date, '%Y-%m-%d').date()
            except ValueError:
                today = _today_utc()
        else:
            today = _today_utc()

        if target_date > today:
            raise ValueError("Cannot log attendance for a future date.")

        if not self._is_self_service_date(target_date, today):
            raise ValueError(
                "This date is outside the self-service window. "
                "Please submit a correction request for manager approval instead."
            )

        # Disallow logging attendance on declared company holidays
        holidays = self.holiday_repo.get_holidays_in_range(date_str, date_str, self.tenant_id)
        if holidays and not holidays[0].get('is_half_day'):
            raise ValueError(f"Attendance logging is disabled for {date_str} as it is a declared Company Holiday ({holidays[0]['name']}).")

        # Determine clock_out_date and validate duration
        clock_out_date = date_str
        if clock_in and clock_out:
            duration_hours, status = compute_shift_duration_and_status(clock_in, clock_out)
            if clock_out < clock_in:
                # Overnight shift ending the next day
                clock_out_date = (target_date + timedelta(days=1)).strftime('%Y-%m-%d')
            if duration_hours > 18.0:
                raise ValueError("Shift duration cannot exceed 18 hours. Please check your clock-in and clock-out times.")
        else:
            status = self._compute_attendance_status(clock_in, clock_out)

        # Apply immediately to attendance table
        self.repo.upsert_attendance(
            employee_code=employee_code,
            date=date_str,
            clock_in=clock_in,
            clock_out=clock_out,
            work_log=f"Self-service correction: {reason}",
            status=status,
            tenant_id=self.tenant_id,
            clock_out_date=clock_out_date
        )

        # Log the correction for audit trail
        self.repo.create_self_service_correction(
            employee_code=employee_code,
            date=date_str,
            clock_in=clock_in,
            clock_out=clock_out,
            reason=reason,
            tenant_id=self.tenant_id,
            clock_out_date=clock_out_date
        )

        # Clear any stale reminders
        att = self.repo.get_todays_attendance(employee_code, date_str, self.tenant_id)
        if att:
            self.repo.clear_reminders_for_attendance(att['id'], self.tenant_id)

        # Notify the employee of the applied correction
        add_notification(
            title="Attendance Correction Applied",
            message=f"Your attendance record for {date_str} has been self-corrected (status: {status}).",
            employee_code=employee_code,
            n_type="Success",
            tenant_id=self.tenant_id
        )
        return {"success": True, "message": "Self-service correction applied", "status": status}

    def apply_correction_request(self, employee_code: str, date_str: str,
                                 clock_in: Optional[str], clock_out: Optional[str],
                                 reason: str, client_date: str = None):
        """
        Submit a correction request for a date outside the self-service window.
        Requires manager approval before being applied.
        """
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            raise ValueError("Invalid date format. Must be YYYY-MM-DD.")

        if client_date:
            try:
                today = datetime.strptime(client_date, '%Y-%m-%d').date()
            except ValueError:
                today = _today_utc()
        else:
            today = _today_utc()

        if target_date > today:
            raise ValueError("Cannot request correction for a future date.")

        # Disallow logging attendance on declared company holidays
        holidays = self.holiday_repo.get_holidays_in_range(date_str, date_str, self.tenant_id)
        if holidays and not holidays[0].get('is_half_day'):
            raise ValueError(f"Attendance logging is disabled for {date_str} as it is a declared Company Holiday ({holidays[0]['name']}).")

        if self._is_self_service_date(target_date, today):
            raise ValueError(
                "This date is still within the self-service window. "
                "Please use the self-service correction instead."
            )

        # Determine clock_out_date and validate duration
        clock_out_date = date_str
        if clock_in and clock_out:
            duration_hours, _ = compute_shift_duration_and_status(clock_in, clock_out)
            if clock_out < clock_in:
                # Overnight shift ending the next day
                clock_out_date = (target_date + timedelta(days=1)).strftime('%Y-%m-%d')
            if duration_hours > 18.0:
                raise ValueError("Shift duration cannot exceed 18 hours. Please check your clock-in and clock-out times.")

        # Create correction request (Pending, requires manager approval)
        self.repo.create_correction_request(
            employee_code=employee_code,
            date=date_str,
            clock_in=clock_in,
            clock_out=clock_out,
            reason=reason,
            tenant_id=self.tenant_id,
            clock_out_date=clock_out_date
        )

        # Notify manager
        manager_code = self.repo.get_manager_code(employee_code, self.tenant_id)
        if manager_code:
            add_notification(
                title="Attendance Correction Request",
                message=f"Employee {employee_code} has submitted a correction request for {date_str}.",
                employee_code=manager_code,
                n_type="AdminAlert",
                tenant_id=self.tenant_id
            )
            manager_email = self.repo.get_employee_email(manager_code, self.tenant_id)
            if manager_email:
                employee_name = self.repo.get_employee_name(employee_code, self.tenant_id)
                manager_name = self.repo.get_employee_name(manager_code, self.tenant_id)
                from backend.core.email_service_extended import send_attendance_correction_request_email
                import os
                company = os.getenv("COMPANY_NAME", self.tenant_id)
                try:
                    send_attendance_correction_request_email(
                        to_email=manager_email,
                        manager_name=manager_name or "Manager",
                        employee_name=f"{employee_name} ({employee_code})",
                        date=f"{date_str} (Requested times: {clock_in or 'N/A'} → {clock_out or 'N/A'})",
                        reason=reason,
                        company_name=company
                    )
                except Exception as mail_err:
                    logger.warning(f"Correction request email to manager {manager_code} failed (non-blocking): {mail_err}")

        # Confirm to employee
        add_notification(
            title="Correction Request Submitted",
            message=f"Your correction request for {date_str} has been submitted and is pending manager approval.",
            employee_code=employee_code,
            n_type="Info",
            tenant_id=self.tenant_id
        )
        return {"success": True, "message": "Correction request submitted successfully"}

    def get_my_corrections(self, employee_code: str):
        """Employee's full correction history (both self-service and requested)."""
        return self.repo.get_my_corrections(employee_code, self.tenant_id)

    def get_pending_correction_requests(self, role: str, employee_code: Optional[str]):
        """Manager/Admin: get pending requested corrections for their team."""
        if role == 'employee':
            if employee_code and self.repo.is_reporting_manager(employee_code, self.tenant_id):
                role = 'manager'
            else:
                return []
        manager_code = employee_code if role == 'manager' else None
        return self.repo.get_pending_correction_requests(manager_code, self.tenant_id)

    def approve_reject_correction_request(self, correction_id: int, action: str,
                                          rejection_reason: Optional[str],
                                          admin_role: str, admin_code: Optional[str]):
        correction = self.repo.get_correction_request_by_id(correction_id, self.tenant_id)
        if not correction:
            raise ValueError("Correction request not found")

        if correction.get('correction_track') != 'requested':
            raise ValueError("Only manager-requested corrections can be approved here.")

        # Prevent self-approval
        if admin_code and correction['employee_code'] == admin_code:
            raise ValueError("You cannot approve your own correction request.")

        # Hierarchy check
        applicant_role = self.repo.get_user_role(correction['employee_code'], self.tenant_id)
        is_direct_manager = (
            admin_code and
            self.repo.get_manager_code(correction['employee_code'], self.tenant_id) == admin_code
        )
        if not is_direct_manager and applicant_role in ['org_admin', 'manager'] and admin_role not in ['org_admin', 'super_admin']:
            raise ValueError("Administrative correction requests can only be approved by an Organization Admin.")

        # Update correction status
        self.repo.update_correction_request_status(
            correction_id=correction_id,
            status=action,
            approved_by=admin_code,
            rejection_reason=rejection_reason,
            tenant_id=self.tenant_id
        )

        if action == 'Approved':
            clock_in = correction['clock_in']
            clock_out = correction['clock_out']
            date = correction['date']
            emp_code = correction['employee_code']
            clock_out_date = correction.get('clock_out_date')

            if not clock_out_date and clock_in and clock_out:
                if clock_out < clock_in:
                    try:
                        d_obj = datetime.strptime(date, '%Y-%m-%d').date()
                        clock_out_date = (d_obj + timedelta(days=1)).strftime('%Y-%m-%d')
                    except Exception:
                        clock_out_date = date
                else:
                    clock_out_date = date

            _, status = compute_shift_duration_and_status(clock_in, clock_out, date, clock_out_date)

            self.repo.upsert_attendance(
                employee_code=emp_code,
                date=date,
                clock_in=clock_in,
                clock_out=clock_out,
                work_log="Correction approved by manager: " + (correction.get('reason') or ''),
                status=status,
                tenant_id=self.tenant_id,
                clock_out_date=clock_out_date
            )

            # Clear any stale clock-out reminders
            att = self.repo.get_todays_attendance(emp_code, date, self.tenant_id)
            if att:
                self.repo.clear_reminders_for_attendance(att['id'], self.tenant_id)

        # Notify employee of the decision
        add_notification(
            title=f"Correction Request {action}",
            message=f"Your attendance correction request for {correction['date']} has been {action.lower()}.",
            employee_code=correction['employee_code'],
            n_type="Success" if action == 'Approved' else "Alert",
            tenant_id=self.tenant_id
        )

        return {"success": True, "message": f"Correction request has been {action.lower()}"}

    def get_bimonthly_report(self, year: int, month: int, cycle: int, manager_code: Optional[str] = None):
        # 1. Determine start and end day based on cycle
        num_days = calendar.monthrange(year, month)[1]
        if cycle == 1:
            start_day = 1
            end_day = 15
        elif cycle == 2:
            start_day = 16
            end_day = num_days
        else:
            raise ValueError("Invalid cycle. Must be 1 or 2.")
            
        start_date = f"{year}-{month:02d}-{start_day:02d}"
        end_date = f"{year}-{month:02d}-{end_day:02d}"
        
        # 2. Fetch employees based on manager segmentation
        employees = self.repo.get_employees_for_reporting(manager_code, self.tenant_id)
        
        # 3. Fetch attendance and leave records for the date range
        attendance_rows = self.repo.get_monthly_attendance(start_date, end_date, self.tenant_id)
        leave_rows = self.repo.get_monthly_approved_leaves(start_date, end_date, self.tenant_id)
        holiday_rows = self.holiday_repo.get_holidays_in_range(start_date, end_date, self.tenant_id)
        holidays_map = {h['date']: h for h in holiday_rows}
        
        # Process maps
        att_map = {}
        for row in attendance_rows:
            e_code = row['employee_code']
            if e_code not in att_map: att_map[e_code] = {}
            
            d_val = row['date']
            d_str = d_val.strftime('%Y-%m-%d') if hasattr(d_val, 'strftime') else str(d_val)
            
            clock_in = row.get('clock_in')
            clock_out = row.get('clock_out')
            
            if clock_in and clock_out:
                _, status = compute_shift_duration_and_status(
                    clock_in, clock_out, d_str, row.get('clock_out_date')
                )
                att_map[e_code][d_str] = status
            elif clock_in:
                today_str = datetime.now(_IST).strftime('%Y-%m-%d')
                yesterday_str = (datetime.now(_IST) - timedelta(days=1)).strftime('%Y-%m-%d')
                is_active = False
                if d_str == today_str:
                    is_active = True
                elif d_str == yesterday_str:
                    try:
                        dt_in = datetime.strptime(f"{d_str} {clock_in}", '%Y-%m-%d %H:%M:%S' if len(str(clock_in)) == 8 else '%Y-%m-%d %H:%M')
                        now_dt = datetime.now(_IST).replace(tzinfo=None)
                        if (now_dt - dt_in).total_seconds() <= 16 * 3600:
                            is_active = True
                    except Exception:
                        pass
                att_map[e_code][d_str] = 'Active' if is_active else 'Absent'
            else:
                 att_map[e_code][d_str] = 'Absent'
                 
        leave_map = {}
        for row in leave_rows:
            code = row['employee_code']
            if code not in leave_map: leave_map[code] = {}
            
            try:
                # leaves might have string dates YYYY-MM-DD
                d1 = datetime.strptime(row['start_date'], '%Y-%m-%d')
                d2 = datetime.strptime(row['end_date'], '%Y-%m-%d')
                
                range_start = datetime(year, month, start_day)
                range_end = datetime(year, month, end_day)
                
                curr = max(d1, range_start)
                end = min(d2, range_end)
                
                while curr <= end:
                    d_str = curr.strftime('%Y-%m-%d')
                    l_status = 'Leave'
                    if curr == d1 and row.get('start_day_type') in ['First Half', 'Second Half']:
                        l_status = f"Half Day Leave ({row.get('start_day_type')})"
                    if curr == d2 and row.get('end_day_type') in ['First Half', 'Second Half']:
                        l_status = f"Half Day Leave ({row.get('end_day_type')})"
                    
                    leave_map[code][d_str] = l_status
                    curr += timedelta(days=1)
            except:
                pass
                
        report = []
        for emp in employees:
            code = emp['employee_code']
            days = []
            present_count = 0
            half_day_count = 0
            leave_count = 0
            absent_count = 0
            holiday_count = 0
            
            for day in range(start_day, end_day + 1):
                date_str = f"{year}-{month:02d}-{day:02d}"
                status = 'Absent'
                
                if code in leave_map and date_str in leave_map[code]:
                    status = leave_map[code][date_str]
                    if status == 'Leave':
                        leave_count += 1
                    else:
                        leave_count += 0.5
                elif code in att_map and date_str in att_map[code]:
                    status = att_map[code][date_str]
                    if status == 'Present' or status == 'Active':
                        present_count += 1
                    elif status.startswith('Half Day'):
                        half_day_count += 1
                    elif status == 'Absent':
                        absent_count += 1
                elif date_str in holidays_map:
                    status = 'Holiday'
                    holiday_count += 1
                else:
                    try:
                        dt = datetime(year, month, day)
                        dt_date = dt.date()
                        today_date = _today_ist()
                        
                        if dt.weekday() >= 5: 
                            status = 'Weekend'
                        elif dt_date > today_date:
                            status = 'Future'
                        elif dt_date == today_date:
                            status = 'Not Started' 
                        else:
                            status = 'Absent'
                            absent_count += 1
                    except:
                        pass
                
                h_name = holidays_map[date_str]['name'] if date_str in holidays_map else None
                days.append({"day": day, "status": status, "date": date_str, "holiday_name": h_name})
                
            report.append({
                "name": emp['name'],
                "code": code,
                "days": days,
                "stats": {
                    "present": present_count,
                    "half_day": half_day_count,
                    "leave": leave_count,
                    "absent": absent_count,
                    "holiday": holiday_count
                }
            })
            
        return report

