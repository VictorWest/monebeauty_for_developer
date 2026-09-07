-- Rotate the application session cookie and formally revoke every session
-- issued before that rotation. User credentials and account records remain.
DELETE FROM "Session";
