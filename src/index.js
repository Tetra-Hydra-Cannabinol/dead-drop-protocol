#!/usr/bin/env node
/**
 * Dead Drop Protocol — Core Library
 * Cross-runtime AI agent communication via Gmail drafts.
 * 
 * By Trajanus USA — Engineered Intelligence™
 * https://deaddrop.trajanus-usa.com
 */

const { google } = require('googleapis');

class DeadDrop {
  constructor(options = {}) {
    this.agentId = options.agentId || 'CC';
    this.gmail = options.gmail || null; // Pre-authenticated gmail service
    this.userId = options.userId || 'me';
    this.staleThreshold = options.staleThreshold || 30 * 60 * 1000; // 30 min
  }

  /**
   * Initialize with Google OAuth credentials
   */
  static async connect(credentials, agentId = 'CC') {
    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);
    const gmail = google.gmail({ version: 'v1', auth });
    return new DeadDrop({ gmail, agentId });
  }

  /**
   * CHECK — Poll drafts for messages addressed to this agent
   * @param {Object} options - { autoDelete: false, limit: 20 }
   * @returns {Array} Messages addressed to this agent
   */
  async check(options = {}) {
    const { autoDelete = false, limit = 20 } = options;
    const res = await this.gmail.users.drafts.list({
      userId: this.userId,
      maxResults: limit,
    });

    const drafts = res.data.drafts || [];
    const messages = [];

    for (const draft of drafts) {
      const detail = await this.gmail.users.drafts.get({
        userId: this.userId,
        id: draft.id,
      });

      const headers = detail.data.message.payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      // Parse routing: [SENDER → RECEIVER]
      const routeMatch = subject.match(/\[(\w+)\s*→\s*(\w+|ALL)\]/);
      if (!routeMatch) continue;

      const [, sender, receiver] = routeMatch;

      // Filter for messages to this agent or ALL
      if (receiver !== this.agentId && receiver !== 'ALL') continue;

      // Decode body
      let body = '';
      const payload = detail.data.message.payload;
      if (payload.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf8');
      } else if (payload.parts) {
        const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf8');
        }
      }

      messages.push({
        draftId: draft.id,
        sender,
        receiver,
        subject: subject.replace(/\[\w+\s*→\s*\w+\]\s*/, ''),
        body,
        date,
        raw: detail.data,
      });

      if (autoDelete) {
        await this.gmail.users.drafts.delete({
          userId: this.userId,
          id: draft.id,
        });
      }
    }

    return messages;
  }

  /**
   * SEND — Create a draft with routing prefix
   * @param {string} recipient - Agent ID (CP, CC1, ALL, etc.)
   * @param {string} topic - Brief subject description
   * @param {string} body - Message content
   * @returns {Object} Created draft info
   */
  async send(recipient, topic, body) {
    const subject = `[${this.agentId} → ${recipient}] ${topic}`;
    const raw = Buffer.from(
      `To: ${this.userId}\r\nSubject: ${subject}\r\n\r\n${body}`
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await this.gmail.users.drafts.create({
      userId: this.userId,
      requestBody: {
        message: { raw },
      },
    });

    return {
      draftId: res.data.id,
      subject,
      recipient,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * STATUS — Show all agents, last seen, pending drafts, stale detection
   * @returns {Object} Agent status map
   */
  async status() {
    const res = await this.gmail.users.drafts.list({
      userId: this.userId,
      maxResults: 50,
    });

    const drafts = res.data.drafts || [];
    const agents = {};
    const now = Date.now();

    for (const draft of drafts) {
      const detail = await this.gmail.users.drafts.get({
        userId: this.userId,
        id: draft.id,
      });

      const headers = detail.data.message.payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      const routeMatch = subject.match(/\[(\w+)\s*→\s*(\w+|ALL)\]/);
      if (!routeMatch) continue;

      const [, sender, receiver] = routeMatch;
      const timestamp = date ? new Date(date).getTime() : 0;

      // Track sender
      if (!agents[sender]) {
        agents[sender] = { lastSeen: 0, pending: 0, stale: false };
      }
      if (timestamp > agents[sender].lastSeen) {
        agents[sender].lastSeen = timestamp;
      }

      // Track pending for receiver
      if (!agents[receiver]) {
        agents[receiver] = { lastSeen: 0, pending: 0, stale: false };
      }
      agents[receiver].pending++;
    }

    // Stale detection
    for (const [id, agent] of Object.entries(agents)) {
      if (agent.pending > 0 && agent.lastSeen > 0) {
        agent.stale = (now - agent.lastSeen) > this.staleThreshold;
      }
      agent.lastSeenFormatted = agent.lastSeen
        ? new Date(agent.lastSeen).toLocaleTimeString()
        : '—';
    }

    return agents;
  }

  /**
   * DELETE — Remove a draft by ID
   * @param {string} draftId
   */
  async deleteDraft(draftId) {
    await this.gmail.users.drafts.delete({
      userId: this.userId,
      id: draftId,
    });
  }

  /**
   * CLEANUP — Delete all drafts from this agent older than threshold
   * @param {number} maxAge - Max age in ms (default: 24 hours)
   * @returns {number} Number of drafts deleted
   */
  async cleanup(maxAge = 24 * 60 * 60 * 1000) {
    const res = await this.gmail.users.drafts.list({
      userId: this.userId,
      maxResults: 100,
    });

    const drafts = res.data.drafts || [];
    let deleted = 0;
    const now = Date.now();

    for (const draft of drafts) {
      const detail = await this.gmail.users.drafts.get({
        userId: this.userId,
        id: draft.id,
      });

      const headers = detail.data.message.payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      const routeMatch = subject.match(/\[(\w+)\s*→/);
      if (!routeMatch || routeMatch[1] !== this.agentId) continue;

      const timestamp = date ? new Date(date).getTime() : 0;
      if (timestamp > 0 && (now - timestamp) > maxAge) {
        await this.gmail.users.drafts.delete({
          userId: this.userId,
          id: draft.id,
        });
        deleted++;
      }
    }

    return deleted;
  }
}

module.exports = { DeadDrop };
