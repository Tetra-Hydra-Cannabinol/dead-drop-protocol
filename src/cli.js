#!/usr/bin/env node
/**
 * Dead Drop Protocol — CLI Tool
 * Usage: dead-drop <command> [options]
 * 
 * Commands:
 *   check              Poll drafts for messages to this agent
 *   send <to> <msg>    Send a message to another agent
 *   status             Show agent roster with last-seen and pending counts
 *   config             Show or set configuration
 *   cleanup            Delete old drafts from this agent
 * 
 * By Trajanus USA — Engineered Intelligence™
 */

const { program } = require('commander');
const { DeadDrop } = require('./index');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.dead-drop');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const TOKEN_FILE = path.join(CONFIG_DIR, 'token.json');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return {
    agentId: 'CC',
    gmailAccount: '',
    staleThreshold: 30,
    autoDelete: false,
  };
}

function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function getDeadDrop() {
  const config = loadConfig();

  if (!fs.existsSync(CREDENTIALS_FILE)) {
    console.error('Error: No credentials found at ~/.dead-drop/credentials.json');
    console.error('Download OAuth credentials from Google Cloud Console and save them there.');
    console.error('See: https://github.com/Tetra-Hydra-Cannabinol/dead-drop-protocol#quick-start');
    process.exit(1);
  }

  const { google } = require('googleapis');
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0]);

  if (fs.existsSync(TOKEN_FILE)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    auth.setCredentials(token);
  } else {
    console.error('Error: No token found at ~/.dead-drop/token.json');
    console.error('Run: dead-drop config --setup to authenticate.');
    process.exit(1);
  }

  const gmail = google.gmail({ version: 'v1', auth });
  return new DeadDrop({
    gmail,
    agentId: config.agentId,
    staleThreshold: config.staleThreshold * 60 * 1000,
  });
}

program
  .name('dead-drop')
  .description('CIA tradecraft for AI agents. Cross-runtime communication via Gmail drafts.')
  .version('1.0.0');

program
  .command('check')
  .description('Poll drafts for messages addressed to this agent')
  .option('--delete', 'Auto-delete after reading')
  .option('--limit <n>', 'Max drafts to check', '20')
  .action(async (opts) => {
    try {
      const dd = await getDeadDrop();
      const messages = await dd.check({
        autoDelete: opts.delete || false,
        limit: parseInt(opts.limit),
      });

      if (messages.length === 0) {
        console.log('No messages for you.');
        return;
      }

      for (const msg of messages) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`From: ${msg.sender}  →  ${msg.receiver}`);
        console.log(`Subject: ${msg.subject}`);
        console.log(`Date: ${msg.date}`);
        console.log(`${'─'.repeat(60)}`);
        console.log(msg.body);
      }
      console.log(`\n${messages.length} message(s) found.`);
    } catch (err) {
      console.error('Error:', err.message);
    }
  });

program
  .command('send <recipient> <message>')
  .description('Send a dead drop message to another agent')
  .option('-t, --topic <topic>', 'Subject topic', 'Message')
  .action(async (recipient, message, opts) => {
    try {
      const dd = await getDeadDrop();
      const result = await dd.send(recipient.toUpperCase(), opts.topic, message);
      console.log(`Draft created: [${dd.agentId} → ${result.recipient}] ${opts.topic}`);
      console.log(`ID: ${result.draftId}`);
    } catch (err) {
      console.error('Error:', err.message);
    }
  });

program
  .command('status')
  .description('Show agent roster with last-seen and pending draft counts')
  .action(async () => {
    try {
      const dd = await getDeadDrop();
      const agents = await dd.status();

      console.log(`\n${'─'.repeat(50)}`);
      console.log('  Agent  │  Last Seen  │  Pending  │  Stale');
      console.log(`${'─'.repeat(50)}`);

      for (const [id, info] of Object.entries(agents).sort()) {
        const stale = info.stale ? '⚠ YES' : 'No';
        console.log(`  ${id.padEnd(6)} │  ${info.lastSeenFormatted.padEnd(10)} │  ${String(info.pending).padEnd(8)} │  ${stale}`);
      }

      console.log(`${'─'.repeat(50)}\n`);
    } catch (err) {
      console.error('Error:', err.message);
    }
  });

program
  .command('config')
  .description('Show or set Dead Drop configuration')
  .option('--agent <id>', 'Set agent identity (CC, CP, CC1, etc.)')
  .option('--stale <minutes>', 'Set stale threshold in minutes')
  .option('--auto-delete', 'Enable auto-delete after reading')
  .option('--no-auto-delete', 'Disable auto-delete after reading')
  .action((opts) => {
    const config = loadConfig();

    if (opts.agent) config.agentId = opts.agent.toUpperCase();
    if (opts.stale) config.staleThreshold = parseInt(opts.stale);
    if (opts.autoDelete === true) config.autoDelete = true;
    if (opts.autoDelete === false) config.autoDelete = false;

    saveConfig(config);

    console.log('\nDead Drop Configuration:');
    console.log(`  Agent ID:        ${config.agentId}`);
    console.log(`  Gmail Account:   ${config.gmailAccount || '(use default)'}`);
    console.log(`  Stale Threshold: ${config.staleThreshold} min`);
    console.log(`  Auto-Delete:     ${config.autoDelete}`);
    console.log(`  Config Dir:      ${CONFIG_DIR}`);
    console.log();
  });

program
  .command('cleanup')
  .description('Delete old drafts from this agent')
  .option('--max-age <hours>', 'Max age in hours', '24')
  .action(async (opts) => {
    try {
      const dd = await getDeadDrop();
      const maxAge = parseInt(opts.maxAge) * 60 * 60 * 1000;
      const deleted = await dd.cleanup(maxAge);
      console.log(`Cleanup complete: ${deleted} draft(s) deleted.`);
    } catch (err) {
      console.error('Error:', err.message);
    }
  });

program.parse();
