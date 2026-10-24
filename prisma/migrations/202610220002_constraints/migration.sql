-- 数据库承担金额、版本与临时期次的一致性保护。
ALTER TABLE "NumberGroup" ADD CONSTRAINT "group_version_positive" CHECK ("version" > 0);
ALTER TABLE "NumberGroup" ADD CONSTRAINT "temporary_target_required" CHECK ("kind" <> 'TEMP' OR "targetDate" IS NOT NULL);
ALTER TABLE "GroupVersion" ADD CONSTRAINT "version_positive" CHECK ("version" > 0);
ALTER TABLE "GroupVersion" ADD CONSTRAINT "tickets_nonempty_array" CHECK (jsonb_typeof("tickets") = 'array' AND jsonb_array_length("tickets") BETWEEN 1 AND 100);
ALTER TABLE "MatchRecord" ADD CONSTRAINT "amount_nonnegative" CHECK ("totalAmount" IS NULL OR "totalAmount" >= 0);
ALTER TABLE "MailJob" ADD CONSTRAINT "attempt_nonnegative" CHECK ("attemptCount" >= 0);
ALTER TABLE "MailAttempt" ADD CONSTRAINT "attempt_positive" CHECK ("number" > 0);
