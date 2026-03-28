import { createMimeMessage } from "mimetext/browser";

export interface MailAttachment {
  filename: string;
  contentType: string;
  data: string; // Base64 encoded data
}

export interface LegacyMailAttachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

export interface SendMailParams {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  attachments?: Array<MailAttachment | LegacyMailAttachment>;
}

export const generateRawMime = (params: SendMailParams): string => {
  const msg = createMimeMessage();
  msg.setSender('me');
  msg.setTo(params.to);
  if (params.cc) {
    msg.setCc(params.cc);
  }
  msg.setSubject(params.subject);
  msg.addMessage({
    contentType: 'text/plain',
    data: params.body,
  });

  if (params.attachments && params.attachments.length > 0) {
    params.attachments.forEach((attachment) => {
      const contentType =
        'contentType' in attachment ? attachment.contentType : attachment.mimeType;
      const data = 'data' in attachment ? attachment.data : attachment.contentBase64;

      msg.addAttachment({
        filename: attachment.filename,
        contentType,
        data,
      });
    });
  }

  return msg.asRaw();
};
