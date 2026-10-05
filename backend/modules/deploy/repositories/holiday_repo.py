from typing import List, Optional, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class HolidayRepository:
    def _set_path(self, cur, tenant_id: str = 'public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def _normalize(self, row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        d = dict(row)
        if d.get('created_at') is not None:
            d['created_at'] = str(d['created_at'])
        if d.get('date') is not None:
            d['date'] = str(d['date'])
        return d

    def get_holidays_by_year(self, year: int, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT * FROM company_holidays 
                WHERE date LIKE %s
                ORDER BY date ASC
            ''', (f"{year}-%",))
            rows = cur.fetchall()
            return [self._normalize(r) for r in rows]
        finally:
            conn.close()

    def get_holidays_in_range(self, start_date: str, end_date: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT * FROM company_holidays 
                WHERE date >= %s AND date <= %s
                ORDER BY date ASC
            ''', (start_date, end_date))
            rows = cur.fetchall()
            return [self._normalize(r) for r in rows]
        finally:
            conn.close()

    def get_holiday_by_id(self, holiday_id: int, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('SELECT * FROM company_holidays WHERE id = %s', (holiday_id,))
            row = cur.fetchone()
            return self._normalize(row)
        finally:
            conn.close()

    def get_holiday_by_date_and_name(self, date: str, name: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('SELECT * FROM company_holidays WHERE date = %s AND LOWER(name) = LOWER(%s)', (date, name))
            row = cur.fetchone()
            return self._normalize(row)
        finally:
            conn.close()

    def create_holiday(self, name: str, date: str, holiday_type: str, description: Optional[str], is_half_day: bool, created_by: Optional[str], tenant_id: str = 'public') -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                INSERT INTO company_holidays (name, date, holiday_type, description, is_half_day, created_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
            ''', (name, date, holiday_type, description, is_half_day, created_by))
            row = cur.fetchone()
            conn.commit()
            return self._normalize(row)
        finally:
            conn.close()

    def update_holiday(self, holiday_id: int, name: Optional[str], date: Optional[str], holiday_type: Optional[str], description: Optional[str], is_half_day: Optional[bool], tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            
            # Fetch existing
            cur.execute('SELECT * FROM company_holidays WHERE id = %s', (holiday_id,))
            existing = cur.fetchone()
            if not existing:
                return None
            
            new_name = name if name is not None else existing['name']
            new_date = date if date is not None else existing['date']
            new_type = holiday_type if holiday_type is not None else existing['holiday_type']
            new_desc = description if description is not None else existing['description']
            new_half = is_half_day if is_half_day is not None else existing['is_half_day']

            cur.execute('''
                UPDATE company_holidays 
                SET name = %s, date = %s, holiday_type = %s, description = %s, is_half_day = %s
                WHERE id = %s
                RETURNING *
            ''', (new_name, new_date, new_type, new_desc, new_half, holiday_id))
            row = cur.fetchone()
            conn.commit()
            return self._normalize(row)
        finally:
            conn.close()

    def delete_holiday(self, holiday_id: int, tenant_id: str = 'public') -> bool:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('DELETE FROM company_holidays WHERE id = %s', (holiday_id,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

