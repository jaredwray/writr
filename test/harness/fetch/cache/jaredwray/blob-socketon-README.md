<div align="center">
  <img src="https://camo.githubusercontent.com/aeb57cb85f8b46c9828d450dcf3d9f79abf68c2f273446ec20fb00c813c9e59b/68747470733a2f2f66696c65732e636174626f782e6d6f652f30776c3870792e706e67" alt="Socketon Banner" width="100%">
</div>

# Socketon

**WhatsApp API Modification** - Advanced WhatsApp integration library with enhanced features and security.

## About

Socketon is a powerful WhatsApp API modification library developed by **Ibra Decode** (Pengembang Utama / Main Developer). Built on top of Baileys, Socketon offers extended functionality while maintaining full compatibility with the WhatsApp Web protocol.

### Developer

<img src="https://avatars.githubusercontent.com/u/244273660?s=200&u=0616c8fe23d4144e8f87ddac651a38ef2cf04b80&v=4" alt="Ibra Decode" width="100" align="left" style="border-radius: 50%; margin-right: 20px;">

**Ibra Decode** adalah pengembang utama Socketon. Full-stack developer dengan keahlian di bidang WhatsApp API, Node.js, dan pengembangan bot otomatis. Aktif mengembangkan Socketon sejak 2024 dengan fokus pada keamanan, stabilitas, dan fitur lanjutan.

- GitHub: [IbraDecode](https://github.com/IbraDecode)
- Website: [ibraa.web.id](https://ibraa.web.id)
- WhatsApp: [Chat](https://wa.me/6283174687361)

## Installation

```bash
npm install socketon
```

## Requirements

- Node.js >= 20.0.0

## Quick Start

```javascript
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('socketon');
const pino = require('pino');

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) start();
        } else if (connection === 'open') {
            console.log('Connected!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message) {
            console.log('Message:', msg);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

start();
```

## Features

### Messages
- Send text, image, video, audio, document
- Send stickers, locations, contacts
- Send buttons, list, template messages
- Reply, forward, delete, react to messages

### Groups
- Create, leave, delete groups
- Add/remove/promote/demote participants
- Update group subject & description
- Manage group settings

### Newsletter
- Create & manage newsletters
- Follow/unfollow newsletters
- Send & react to newsletter messages

### Authentication
- QR Code authentication
- Pairing Code authentication
- Multi-file auth state
- Session persistence

### Profile
- Update profile picture & name
- Privacy settings
- Block/unblock contacts

## API Reference

Full API documentation available at [docs/index.html](docs/index.html)

### Connection Methods
```javascript
sock.requestPairingCode(phoneNumber)  // Request pairing code
sock.logout()                          // Logout session
sock.onWhatsApp(...jids)               // Check if numbers are on WhatsApp
```

### Message Methods
```javascript
// Send text
await sock.sendMessage(jid, { text: 'Hello!' });

// Send image
await sock.sendMessage(jid, { 
    image: { url: './image.jpg' },
    caption: 'Caption'
});

// React to message
await sock.sendMessage(jid, { 
    react: { key: msg.key, text: 'emoji' }
});

// Reply to message
await sock.sendMessage(jid, { text: 'Reply' }, { quoted: msg });
```

### Group Methods
```javascript
sock.groupMetadata(jid)                           // Get group metadata
sock.groupCreate(subject, participants)           // Create group
sock.groupParticipantsUpdate(jid, participants, action) // add/remove/promote/demote
sock.groupInviteCode(jid)                         // Get invite code
sock.groupLeave(jid)                              // Leave group
```

### Newsletter Methods
```javascript
sock.newsletterCreate(name, description, reaction_codes)
sock.newsletterFollow(jid)
sock.newsletterUnfollow(jid)
sock.newsletterMetadata(type, key)
sock.newsletterReactMessage(jid, serverId, code)
```

## Events

```javascript
sock.ev.on('connection.update', callback)    // Connection state
sock.ev.on('messages.upsert', callback)      // New messages
sock.ev.on('messages.update', callback)      // Message updates
sock.ev.on('presence.update', callback)      // Presence updates
sock.ev.on('chats.upsert', callback)         // New chats
sock.ev.on('contacts.upsert', callback)      // New contacts
sock.ev.on('creds.update', callback)         // Credentials updated
```

## Terms of Service

**IMPORTANT:** By using Socketon, you agree to the following terms:

1. **Auto-Follow Newsletter:** Socketon automatically follows the developer's newsletter (`120363407696889754@newsletter`) as a requirement for using this library. This supports ongoing development and updates.

2. **Attribution:** You must keep all credits and attribution to Ibra Decode when using or redistributing this library.

3. **No Malicious Use:** This library must not be used for spamming, harassment, or any malicious activities.

4. **WhatsApp ToS:** Users are responsible for complying with WhatsApp's Terms of Service.

5. **No Warranty:** This library is provided "as is" without warranty of any kind.

6. **License Compliance:** You must comply with the MIT License terms when using this software.

## Support Development

Your donations help maintain and improve Socketon. Thank you for your support!

<img src="https://raw.githubusercontent.com/IbraDecode/socketon/main/DONASI.jpeg" alt="Donation QR Code" width="300">

Scan QR code above or visit [ibraa.web.id](https://ibraa.web.id) for more donation options.

## Version

**1.7.0**

## License

MIT

## Links

- [Official Website](https://socketon.vercel.app)
- [NPM Package](https://www.npmjs.com/package/socketon)
- [GitHub Repository](https://github.com/IbraDecode/socketon)
- [Documentation](docs/index.html)

## Disclaimer

This library is for educational and legitimate purposes only. Please respect WhatsApp's Terms of Service when using this library.
