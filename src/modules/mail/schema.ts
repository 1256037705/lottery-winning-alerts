import { z } from 'zod';
export const smtpSchema = z.object({
  host: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^[a-zA-Z0-9.-]+$/, '请输入主机名，不要包含协议或路径'),
  port: z.union([z.literal(465), z.literal(587)]),
  username: z.string().min(1).max(254),
  password: z.string().max(500).default(''),
  from: z.email(),
  senderName: z.string().min(1).max(60).default('开奖追踪'),
  recipients: z.array(z.email()).min(1).max(20),
  autoEnabled: z.boolean().default(false),
});
export type SmtpInput = z.infer<typeof smtpSchema>;
export type StoredSmtp = Omit<SmtpInput, 'password'> & { encryptedPassword: string };
