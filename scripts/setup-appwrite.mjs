/**
 * Setup Appwrite Cloud - Create database and collections
 * This script uses the Appwrite Server SDK with the API key provided
 * 
 * IMPORTANT: The project must already exist on Appwrite Cloud Console.
 * If the project ID doesn't exist, you need to create it manually at:
 * https://cloud.appwrite.io/console
 */

import { Client, Databases, ID, Query } from "node-appwrite";

const APPWRITE_ENDPOINT = "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69f0d73900204f7b5dfc";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "standard_6c0406ef90dc86f4f8635a54ca837ad9e312137429ce2f613229bafae995abc97d120626862b214236a7f8f2a30cd3c498bb385f30abd0f51f46b0ce5083dc2494caa8cbac9f167e64019d71e1aacac9eaaa5dd96ce2e5851f4616bac7e63e27fb4dd18c96868b98c633919d5bb2903301f174296aba05f1e2dac8c87fdebcb7";

const DATABASE_ID = "hf_space_chat";
const DATABASE_NAME = "HF Space Chat";

const COLLECTIONS = {
  PROFILES: "profiles",
  CHAT_SESSIONS: "chat_sessions", 
  CHAT_MESSAGES: "chat_messages",
  SITE_SETTINGS: "site_settings",
  PROJECTS: "projects",
  DEPLOYMENTS: "deployments",
};

async function main() {
  console.log("🔧 Setting up Appwrite Cloud...");
  console.log(`📌 Project ID: ${APPWRITE_PROJECT_ID}`);
  console.log(`📌 Endpoint: ${APPWRITE_ENDPOINT}`);

  const client = new Client();
  client
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const db = new Databases(client);

  // Step 1: Create Database
  console.log("\n📦 Creating database...");
  let database;
  try {
    database = await db.create(DATABASE_ID, DATABASE_NAME);
    console.log(`✅ Database "${DATABASE_NAME}" created with ID: ${DATABASE_ID}`);
  } catch (error) {
    if (error?.code === 409) {
      console.log(`ℹ️ Database "${DATABASE_NAME}" already exists`);
    } else {
      console.error(`❌ Failed to create database:`, error.message);
      console.log("\n⚠️  The project ID might not exist on Appwrite Cloud.");
      console.log("   Please create a project at: https://cloud.appwrite.io/console");
      console.log("   Then update the APPWRITE_PROJECT_ID in this script and in .env.local");
      process.exit(1);
    }
  }

  // Step 2: Create Collections
  const collectionDefs = [
    {
      id: COLLECTIONS.PROFILES,
      name: "Profiles",
      attributes: [
        { key: "email", type: "string", size: 255, required: true },
        { key: "display_name", type: "string", size: 255, required: false },
        { key: "role", type: "string", size: 50, required: true, default: "user" },
        { key: "avatar_url", type: "string", size: 500, required: false },
        { key: "bio", type: "string", size: 1000, required: false },
        { key: "phone", type: "string", size: 50, required: false },
        { key: "website", type: "string", size: 500, required: false },
        { key: "location", type: "string", size: 255, required: false },
        { key: "language_preference", type: "string", size: 10, required: false, default: "ar" },
        { key: "theme_preference", type: "string", size: 20, required: false, default: "system" },
        { key: "notifications_enabled", type: "boolean", required: false, default: true },
      ],
    },
    {
      id: COLLECTIONS.CHAT_SESSIONS,
      name: "Chat Sessions",
      attributes: [
        { key: "user_id", type: "string", size: 255, required: true },
        { key: "name", type: "string", size: 500, required: true },
      ],
    },
    {
      id: COLLECTIONS.CHAT_MESSAGES,
      name: "Chat Messages",
      attributes: [
        { key: "session_id", type: "string", size: 255, required: true },
        { key: "role", type: "string", size: 50, required: true },
        { key: "content", type: "string", size: 65535, required: true },
      ],
    },
    {
      id: COLLECTIONS.SITE_SETTINGS,
      name: "Site Settings",
      attributes: [
        { key: "key", type: "string", size: 255, required: true },
        { key: "value", type: "string", size: 10000, required: true },
      ],
    },
    {
      id: COLLECTIONS.PROJECTS,
      name: "Projects",
      attributes: [
        { key: "user_id", type: "string", size: 255, required: true },
        { key: "name", type: "string", size: 500, required: true },
        { key: "template", type: "string", size: 100, required: false },
        { key: "files", type: "string", size: 65535, required: false },
        { key: "description", type: "string", size: 2000, required: false },
      ],
    },
    {
      id: COLLECTIONS.DEPLOYMENTS,
      name: "Deployments",
      attributes: [
        { key: "user_id", type: "string", size: 255, required: true },
        { key: "project_id", type: "string", size: 255, required: false },
        { key: "platform", type: "string", size: 100, required: true },
        { key: "url", type: "string", size: 1000, required: false },
        { key: "status", type: "string", size: 50, required: true, default: "pending" },
        { key: "config", type: "string", size: 65535, required: false },
      ],
    },
  ];

  for (const collDef of collectionDefs) {
    console.log(`\n📋 Creating collection: ${collDef.name}...`);
    
    try {
      await db.createCollection(DATABASE_ID, collDef.id, collDef.name);
      console.log(`  ✅ Collection "${collDef.name}" created`);
    } catch (error) {
      if (error?.code === 409) {
        console.log(`  ℹ️ Collection "${collDef.name}" already exists`);
      } else {
        console.error(`  ❌ Failed to create collection:`, error.message);
        continue;
      }
    }

    // Create string attributes
    for (const attr of collDef.attributes) {
      if (attr.type === "string") {
        try {
          if (attr.size > 5000) {
            await db.createTextAttribute(DATABASE_ID, collDef.id, attr.key, attr.required || false, attr.size, attr.default);
          } else {
            await db.createStringAttribute(DATABASE_ID, collDef.id, attr.key, attr.size, attr.required || false, attr.default);
          }
          console.log(`    ✅ Attribute "${attr.key}" created`);
        } catch (error) {
          if (error?.code === 409) {
            console.log(`    ℹ️ Attribute "${attr.key}" already exists`);
          } else {
            console.error(`    ❌ Failed to create attribute "${attr.key}":`, error.message);
          }
        }
      } else if (attr.type === "boolean") {
        try {
          await db.createBooleanAttribute(DATABASE_ID, collDef.id, attr.key, attr.required || false, attr.default);
          console.log(`    ✅ Attribute "${attr.key}" created`);
        } catch (error) {
          if (error?.code === 409) {
            console.log(`    ℹ️ Attribute "${attr.key}" already exists`);
          } else {
            console.error(`    ❌ Failed to create attribute "${attr.key}":`, error.message);
          }
        }
      }
    }
  }

  console.log("\n\n🎉 Appwrite Cloud setup complete!");
  console.log("\n⚠️  IMPORTANT: You still need to set up the following manually in Appwrite Console:");
  console.log("   1. Go to https://cloud.appwrite.io/console");
  console.log("   2. Navigate to your project → Auth → Settings");
  console.log("   3. Enable Email/Password auth");
  console.log("   4. Add your domain to allowed hosts in Auth → Settings");
  console.log("   5. Create API keys with appropriate scopes if needed");
}

main().catch(console.error);
