import { createMimeMessage } from "mimetext/browser";

export interface SendMailParams {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}

export const generateRawMime = (params: SendMailParams): string => {
  const msg = createMimeMessage();
  msg.setSender("me");
  msg.setTo(params.to);
  if (params.cc) {
    msg.setCc(params.cc);
  }
  msg.setSubject(params.subject);
  msg.addMessage({
    contentType: "text/plain",
    data: params.body,
  });

  return msg.asRaw();
};
