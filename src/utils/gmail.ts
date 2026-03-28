import axios from "axios";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface MessageSummary {
  id: string;
  threadId: string;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  mimeType: string;
  body: {
    data: string;
    size: number;
  };
  parts?: GmailPart[];
}

export interface GmailMessagePayload {
  headers: GmailHeader[];
  parts?: GmailPart[];
  body?: {
    data: string;
    size: number;
  };
}

export interface MessageDetail {
  id: string;
  threadId: string;
  snippet: string;
  payload: GmailMessagePayload;
  internalDate: string;
}

export interface ParsedMail {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
}

export const fetchMessages = async (
  accessToken: string,
  pageToken?: string,
) => {
  const response = await axios.get(`${GMAIL_API_BASE}/messages`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      maxResults: 10,
      pageToken,
    },
  });
  return response.data;
};

export const fetchMessageDetail = async (
  accessToken: string,
  messageId: string,
): Promise<MessageDetail> => {
  const response = await axios.get(`${GMAIL_API_BASE}/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
};

export const decodeBase64 = (data: string) => {
  try {
    // Replace URL-safe characters and decode
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return decoded;
  } catch (e) {
    console.error("Decoding failed:", e);
    return "";
  }
};

export const getBody = (payload: GmailMessagePayload | GmailPart): string => {
  let body = "";
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        body += decodeBase64(part.body.data);
      } else if (part.parts) {
        body += getBody(part);
      }
    }
  } else if ("body" in payload && payload.body?.data) {
    body = decodeBase64(payload.body.data);
  }
  return body;
};

export const parseMessage = (message: MessageDetail): ParsedMail => {
  const headers = message.payload.headers;
  const getHeader = (name: string) =>
    headers.find((h: GmailHeader) => h.name === name)?.value || "";

  return {
    id: message.id,
    subject: getHeader("Subject"),
    from: getHeader("From"),
    date: new Date(parseInt(message.internalDate)).toLocaleString(),
    snippet: message.snippet,
    body: getBody(message.payload),
  };
};

export const sendMail = async (accessToken: string, rawMime: string) => {
  // UTF-8 문자열을 Base64URL로 안전하게 인코딩
  const encoder = new TextEncoder();
  const data = encoder.encode(rawMime);
  let binary = "";
  const bytes = new Uint8Array(data);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const base64Url = base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await axios.post(
    `${GMAIL_API_BASE}/messages/send`,
    { raw: base64Url },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
};
