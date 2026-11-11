-- Removes the 10 demo students (cascades profile, interests, bookmarks, applications, notifications).
begin;
delete from auth.users where email like 'student__@agriopportunity.test';
commit;
