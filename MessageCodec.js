class Message {
  constructor(headers, payload) {
    this.headers = headers;
    this.payload = payload;
  }
}

class MessageCodec {
  constructor() {
    this.MAX_HEADER_SIZE = 1023;
    this.MAX_HEADERS = 63;
    this.MAX_PAYLOAD_SIZE = 256 * 1024; // 256 KiB
  }

  encode(message) {
    const { headers, payload } = message;

    // Check for maximum headers and payload size
    if (Object.keys(headers).length > this.MAX_HEADERS) {
      throw new Error(`Too many headers. Maximum allowed: ${this.MAX_HEADERS}`);
    }

    const headerPairs = Object.entries(headers);

    let totalHeaderSize = 0;
    const headerBuffers = [];

    // Calculate the total header size and encode headers
    for (const [name, value] of headerPairs) {
      const nameBytes = this.encodeString(name);
      const valueBytes = this.encodeString(value);

      const headerSize = 4 + nameBytes.length + valueBytes.length;
      totalHeaderSize += headerSize;

      if (
        nameBytes.length > this.MAX_HEADER_SIZE ||
        valueBytes.length > this.MAX_HEADER_SIZE
      ) {
        throw new Error(
          `Header name or value exceeds maximum allowed size of ${this.MAX_HEADER_SIZE} bytes.`
        );
      }

      // Create a buffer for each header with the length prefix
      const headerBuffer = new Uint8Array(headerSize);
      const view = new DataView(headerBuffer.buffer);

      view.setUint16(0, nameBytes.length);
      view.setUint16(2, valueBytes.length);

      // Copy the name and value bytes to the header buffer
      headerBuffer.set(nameBytes, 4);
      headerBuffer.set(valueBytes, 4 + nameBytes.length);

      headerBuffers.push(headerBuffer);
    }

    if (totalHeaderSize > this.MAX_PAYLOAD_SIZE) {
      throw new Error(
        "Total headers size exceeds maximum allowed payload size."
      );
    }

    // Convert the payload to bytes
    const payloadBytes = this.encodeString(payload);
    if (payloadBytes.length > this.MAX_PAYLOAD_SIZE) {
      throw new Error(
        `Payload size exceeds maximum allowed size of ${this.MAX_PAYLOAD_SIZE} bytes.`
      );
    }

    // Create the final buffer for the entire message
    const totalMessageSize = 1 + totalHeaderSize + payloadBytes.length;
    const messageBuffer = new Uint8Array(totalMessageSize);
    const view = new DataView(messageBuffer.buffer);

    // Set the number of headers as a 8-bit unsigned integer
    view.setUint8(0, headerPairs.length);

    // Copy the header buffers to the message buffer
    let offset = 1;
    for (const headerBuffer of headerBuffers) {
      messageBuffer.set(headerBuffer, offset);
      offset += headerBuffer.length;
    }

    // Copy the payload bytes to the message buffer
    messageBuffer.set(payloadBytes, offset);

    // Return the encoded message as a Uint8Array
    return messageBuffer;
  }

  decode(data) {
    const view = new DataView(data.buffer);

    // Read the number of headers as a 8-bit unsigned integer
    const numHeaders = view.getUint8(0);

    // Decode the headers
    const headers = {};
    let offset = 1;
    for (let i = 0; i < numHeaders; i++) {
      const nameLength = view.getUint16(offset);
      const valueLength = view.getUint16(offset + 2);

      const nameBytes = data.subarray(offset + 4, offset + 4 + nameLength);
      const valueBytes = data.subarray(
        offset + 4 + nameLength,
        offset + 4 + nameLength + valueLength
      );

      const name = this.decodeString(nameBytes);
      const value = this.decodeString(valueBytes);

      headers[name] = value;
      offset += 4 + nameLength + valueLength;
    }

    // Decode the payload bytes back to a string
    const payloadBytes = data.subarray(offset);
    const payload = this.decodeString(payloadBytes);

    return new Message(headers, payload);
  }

  encodeString(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  decodeString(data) {
    const decoder = new TextDecoder();
    return decoder.decode(data);
  }
}

// Example usage:
const headers = {
  "Content-Type": "text/plain",
  Authorization: "Bearer ABCDEFG123456789",
  "Custom-Header": "Hello, Custom!",
};

const payload = "This is the binary payload of the message.";

const message = new Message(headers, payload);
const codec = new MessageCodec();

try {
  const encodedData = codec.encode(message);
  console.log(encodedData);
  // Simulate message transmission and reception
  // On the receiver's side:
  const decodedMessage = codec.decode(encodedData);
  console.log(decodedMessage.headers); // Output: { "Content-Type": "text/plain", "Authorization": "Bearer ABCDEFG123456789", "Custom-Header": "Hello, Custom!" }
  console.log(decodedMessage.payload); // Output: "This is the binary payload of the message."
} catch (error) {
  console.error(error.message);
}
