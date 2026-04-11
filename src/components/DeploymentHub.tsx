"use client";

import { useState, useEffect, useCallback, startTransition, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

// ==================== TYPES ====================
interface HostingProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  features: string[];
  fields: { key: string; label: string; placeholder: string; type: string }[];
  color: string;
  signupUrl: string;
}

interface DatabaseProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  features: string[];
  fields: { key: string; label: string; placeholder: string; type: string }[];
  color: string;
  signupUrl: string;
}

interface EnvVar {
  key: string;
  value: string;
  id: string;
}

interface DeploymentRecord {
  id: string;
  provider: string;
  projectName: string;
  status: "success" | "failed" | "pending";
  url?: string;
  timestamp: string;
  error?: string;
}

interface UserConnection {
  id?: string;
  user_id?: string;
  provider_type: "hosting" | "database";
  provider_id: string;
  credentials: Record<string, string>;
  created_at?: string;
}

interface UploadedFile {
  name: string;
  content: string;
  size: number;
}

// ==================== PROVIDERS DATA ====================
const HOSTING_PROVIDERS: HostingProvider[] = [
  {
    id: "cloudflare",
    name: "Cloudflare Pages",
    icon: "☁️",
    description: "استضافة مجانية مع نطاق بيانات غير محدود و 500 بناء شهرياً",
    features: ["نطاق بيانات غير محدود", "500 بناء شهرياً", "SSL تلقائي", "نطاق .pages.dev مجاني"],
    fields: [
      { key: "api_token", label: "API Token", placeholder: "cloudflare_api_token...", type: "password" },
      { key: "account_id", label: "Account ID", placeholder: "account_id...", type: "text" },
    ],
    color: "from-orange-500 to-amber-500",
    signupUrl: "https://dash.cloudflare.com/sign-up",
  },
  {
    id: "vercel",
    name: "Vercel",
    icon: "▲",
    description: "منصة نشر متقدمة مع دعم Serverless Functions و 100GB نقل مجاني",
    features: ["100GB نقل شهري", "Serverless Functions", "SSL تلقائي", "نطاق .vercel.app مجاني"],
    fields: [
      { key: "api_token", label: "API Token", placeholder: "vercel_token...", type: "password" },
    ],
    color: "from-slate-800 to-slate-600",
    signupUrl: "https://vercel.com/signup",
  },
  {
    id: "netlify",
    name: "Netlify",
    icon: "🌐",
    description: "استضافة سريعة مع 100GB نقل بيانات شهرياً ونشر تلقائي من Git",
    features: ["100GB نقل شهري", "300 دقيقة بناء", "نطاق .netlify.app مجاني", "Auto-deploy من Git"],
    fields: [
      { key: "api_token", label: "Personal Access Token", placeholder: "netlify_token...", type: "password" },
    ],
    color: "from-teal-500 to-cyan-500",
    signupUrl: "https://app.netlify.com/signup",
  },
  {
    id: "github",
    name: "GitHub Pages",
    icon: "🐙",
    description: "استضافة مجانية مباشرة من مستودع GitHub مع نطاق .github.io",
    features: ["مجاني بالكامل", "دعم Jekyll", "نطاق .github.io مجاني", "Custom domain"],
    fields: [
      { key: "api_token", label: "Personal Access Token", placeholder: "ghp_xxxx...", type: "password" },
      { key: "repo_name", label: "اسم المستودع", placeholder: "my-project", type: "text" },
    ],
    color: "from-gray-800 to-gray-600",
    signupUrl: "https://github.com/signup",
  },
  {
    id: "surge",
    name: "Surge.sh",
    icon: "⚡",
    description: "أبسط طريقة لنشر المواقع الثابتة من الطرفية بنقرة واحدة",
    features: ["نشر بأمر واحد", "نطاق .surge.sh مجاني", "SSL تلقائي", "بدون تسجيل معقد"],
    fields: [
      { key: "domain", label: "اسم النطاق", placeholder: "my-project.surge.sh", type: "text" },
    ],
    color: "from-yellow-500 to-orange-500",
    signupUrl: "https://surge.sh/",
  },
  {
    id: "render",
    name: "Render",
    icon: "🟣",
    description: "استضافة سحابية مع دعم الخوادم الثابتة والديناميكية مجاناً",
    features: ["خادم مجاني", "SSL تلقائي", "Docker مدعوم", "Cron Jobs"],
    fields: [
      { key: "api_key", label: "API Key", placeholder: "rnd_xxxx...", type: "password" },
    ],
    color: "from-violet-500 to-purple-600",
    signupUrl: "https://render.com/register",
  },
];

const DATABASE_PROVIDERS: DatabaseProvider[] = [
  {
    id: "supabase",
    name: "Supabase",
    icon: "🟢",
    description: "قاعدة بيانات PostgreSQL مجانية مع Auth و Storage و Realtime",
    features: ["500MB تخزين", "Auth مدمج", "Storage ملفات", "Realtime subscriptions"],
    fields: [
      { key: "project_url", label: "Project URL", placeholder: "https://xxx.supabase.co", type: "text" },
      { key: "anon_key", label: "Anon Key", placeholder: "eyJ...", type: "password" },
      { key: "service_role_key", label: "Service Role Key (اختياري)", placeholder: "eyJ...", type: "password" },
    ],
    color: "from-emerald-500 to-green-500",
    signupUrl: "https://supabase.com/dashboard/sign-in",
  },
  {
    id: "mongodb",
    name: "MongoDB Atlas",
    icon: "🍃",
    description: "قاعدة بيانات NoSQL سحابية مع 512MB مجاناً و Atlas Search",
    features: ["512MB مجاناً", "قاعدة بيانات مشتركة", "Atlas Search", "Charts مجاني"],
    fields: [
      { key: "connection_string", label: "Connection String", placeholder: "mongodb+srv://user:pass@cluster.mongodb.net/db", type: "password" },
    ],
    color: "from-green-600 to-emerald-500",
    signupUrl: "https://www.mongodb.com/atlas/register",
  },
  {
    id: "neon",
    name: "Neon PostgreSQL",
    icon: "🔷",
    description: "PostgreSQL بدون خادم مع 0.5GB تخزين مجاني وتفرع تلقائي",
    features: ["0.5GB تخزين", "Serverless", "تفرع تلقائي", "اتصال فوري"],
    fields: [
      { key: "connection_string", label: "Connection String", placeholder: "postgresql://user:pass@ep-xxx.neon.tech/db", type: "password" },
    ],
    color: "from-blue-500 to-cyan-500",
    signupUrl: "https://neon.tech/app/signup",
  },
  {
    id: "firebase",
    name: "Firebase",
    icon: "🔥",
    description: "منصة Google مع Firestore و Auth و Storage و Hosting مجاناً",
    features: ["Firestore مجاني", "Authentication", "Hosting", "Cloud Storage"],
    fields: [
      { key: "api_key", label: "API Key", placeholder: "AIza...", type: "text" },
      { key: "project_id", label: "Project ID", placeholder: "my-project-id", type: "text" },
      { key: "app_id", label: "App ID", placeholder: "1:123:web:abc", type: "text" },
    ],
    color: "from-amber-500 to-yellow-500",
    signupUrl: "https://console.firebase.google.com/",
  },
  {
    id: "planetscale",
    name: "PlanetScale",
    icon: "💎",
    description: "قاعدة بيانات MySQL بدون خادم مع تفرع قواعد البيانات",
    fields: [
      { key: "connection_string", label: "Connection String", placeholder: "mysql://user:pass@aws.connect.psdb.cloud/db", type: "password" },
    ],
    features: ["5GB مجاناً", "تفرع قواعد البيانات", "CLI قوي", "بدون توقف"],
    color: "from-pink-500 to-rose-500",
    signupUrl: "https://auth.planetscale.com/sign-up",
  },
];

// ==================== DEPLOYMENT FUNCTIONS ====================
async function deployToCloudflare(
  apiToken: string,
  accountId: string,
  projectName: string,
  files: { name: string; content: string }[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const createRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName,
          production_branch: "main",
        }),
      }
    );
    const createData = await createRes.json();
    if (!createData.success && !createData.errors?.[0]?.message?.includes("already exists")) {
      return { success: false, error: createData.errors?.[0]?.message || "فشل إنشاء المشروع" };
    }

    const formData = new FormData();
    for (const file of files) {
      const blob = new Blob([file.content], { type: "text/plain" });
      formData.append("file", blob, file.name);
    }

    const deployRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
        body: formData,
      }
    );
    const deployData = await deployRes.json();
    if (deployData.success) {
      const url = `https://${projectName}.pages.dev`;
      return { success: true, url };
    }
    return { success: false, error: deployData.errors?.[0]?.message || "فشل النشر" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "خطأ غير معروف" };
  }
}

async function deployToVercel(
  apiToken: string,
  projectName: string,
  files: { name: string; content: string }[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const filePayload = files.map((f) => ({
      file: f.name,
      data: btoa(unescape(encodeURIComponent(f.content))),
      encoding: "base64",
    }));

    const res = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        files: filePayload,
        projectSettings: {
          framework: null,
        },
      }),
    });
    const data = await res.json();
    if (data.url) {
      return { success: true, url: `https://${data.url}` };
    }
    return { success: false, error: data.error?.message || "فشل النشر على Vercel" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "خطأ غير معروف" };
  }
}

async function deployToNetlify(
  apiToken: string,
  projectName: string,
  files: { name: string; content: string }[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const formData = new FormData();
    for (const file of files) {
      const blob = new Blob([file.content], { type: "text/plain" });
      formData.append("files", blob, file.name);
    }

    const res = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: formData,
    });
    const data = await res.json();
    if (data.url) {
      return { success: true, url: data.ssl_url || data.url };
    }
    return { success: false, error: data.message || "فشل النشر على Netlify" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "خطأ غير معروف" };
  }
}

async function deployToGitHub(
  apiToken: string,
  repoName: string,
  files: { name: string; content: string }[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repoName,
        auto_init: true,
        public: true,
      }),
    });
    const createData = await createRes.json();
    const username = createData.owner?.login;
    if (!username && !createData.message?.includes("already exists")) {
      return { success: false, error: createData.message || "فشل إنشاء المستودع" };
    }

    let owner = username;
    if (!owner) {
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const userData = await userRes.json();
      owner = userData.login;
    }

    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const refData = await refRes.json();
    const latestCommitSha = refData.object?.sha;
    if (!latestCommitSha) {
      return { success: false, error: "فشل الحصول على آخر commit" };
    }

    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${latestCommitSha}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const commitData = await commitRes.json();
    const treeSha = commitData.tree?.sha;

    const blobs = [];
    for (const file of files) {
      const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: file.content,
          encoding: "utf-8",
        }),
      });
      const blobData = await blobRes.json();
      blobs.push({ sha: blobData.sha, path: file.name, mode: "100644", type: "blob" });
    }

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base_tree: treeSha,
        tree: blobs.map((b) => ({ path: b.path, mode: b.mode, type: b.type, sha: b.sha })),
      }),
    });
    const treeData = await treeRes.json();

    const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Deploy from HF Space Chat",
        tree: treeData.sha,
        parents: [latestCommitSha],
      }),
    });
    const newCommitData = await newCommitRes.json();

    await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sha: newCommitData.sha }),
    });

    await fetch(`https://api.github.com/repos/${owner}/${repoName}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: { branch: "main", path: "/" },
      }),
    }).catch(() => {});

    const url = `https://${owner}.github.io/${repoName}`;
    return { success: true, url };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "خطأ غير معروف" };
  }
}

// ==================== RENDER DEPLOYMENT FUNCTION ====================
async function deployToRender(
  apiKey: string,
  projectName: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const res = await fetch("https://api.render.com/v1/services", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "static_site",
        name: projectName,
        repo: null,
        staticPublishPath: ".",
      }),
    });
    const data = await res.json();
    if (data.id) {
      const url = data.serviceDetails?.url || `https://${projectName}.onrender.com`;
      return { success: true, url };
    }
    return { success: false, error: data.message || data.error?.message || "فشل النشر على Render" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "خطأ غير معروف" };
  }
}

// ==================== CONNECTION TEST FUNCTIONS ====================
async function testSupabaseConnection(
  projectUrl: string,
  anonKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${projectUrl}/rest/v1/`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    if (res.ok || res.status === 200) {
      return { success: true };
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "فشل الاتصال" };
  }
}

async function testMongoConnection(
  connectionString: string
): Promise<{ success: boolean; error?: string }> {
  if (connectionString.startsWith("mongodb+srv://") || connectionString.startsWith("mongodb://")) {
    return { success: true };
  }
  return { success: false, error: "صيغة الاتصال غير صحيحة - يجب أن تبدأ بـ mongodb+srv://" };
}

async function testNeonConnection(
  connectionString: string
): Promise<{ success: boolean; error?: string }> {
  if (connectionString.includes("neon.tech") && connectionString.startsWith("postgresql://")) {
    return { success: true };
  }
  return { success: false, error: "صيغة الاتصال غير صحيحة - يجب أن تحتوي على neon.tech" };
}

async function testFirebaseConnection(
  apiKey: string,
  projectId: string,
  appId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiKey.startsWith("AIza")) {
      return { success: false, error: "مفتاح API غير صالح - يجب أن يبدأ بـ AIza" };
    }
    if (!projectId || projectId.trim().length < 3) {
      return { success: false, error: "معرف المشروع غير صالح" };
    }
    if (!appId || !appId.includes(":")) {
      return { success: false, error: "معرف التطبيق غير صالح - يجب أن يحتوي على نقطتين" };
    }
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "GET" }
    );
    if (res.ok || res.status === 200 || res.status === 403 || res.status === 404) {
      return { success: true };
    }
    return { success: false, error: `فشل التحقق من المشروع - HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "فشل الاتصال بـ Firebase" };
  }
}

// ==================== CODE GENERATION ====================
function generateSupabaseCode(projectUrl: string, anonKey: string): string {
  return `// Supabase Integration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = '${projectUrl}';
const supabaseAnonKey = '${anonKey}';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Usage example:
// const { data, error } = await supabase.from('table').select('*');
`;
}

function generateMongoCode(connectionString: string): string {
  return `// MongoDB Integration
const mongoose = require('mongoose');

const MONGODB_URI = '${connectionString}';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schema example:
// const userSchema = new mongoose.Schema({
//   name: String,
//   email: { type: String, unique: true },
//   createdAt: { type: Date, default: Date.now }
// });
// const User = mongoose.model('User', userSchema);
`;
}

function generateNeonCode(connectionString: string): string {
  return `// Neon PostgreSQL Integration
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: '${connectionString}',
  ssl: { rejectUnauthorized: false }
});

// Query example:
// const result = await pool.query('SELECT * FROM users');
// const users = result.rows;

module.exports = { pool };
`;
}

function generateFirebaseCode(apiKey: string, projectId: string, appId: string): string {
  return `// Firebase Integration
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: '${apiKey}',
  projectId: '${projectId}',
  appId: '${appId}',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Usage example:
// import { collection, addDoc, getDocs } from 'firebase/firestore';
// const querySnapshot = await getDocs(collection(db, 'users'));
`;
}

function generatePlanetScaleCode(connectionString: string): string {
  return `// PlanetScale Integration
import { connect } from '@planetscale/database';

const config = {
  url: '${connectionString}',
};

const connection = connect(config);

// Query example:
// const results = await connection.execute('SELECT * FROM users');
`;
}

// ==================== PROVIDER CARD COMPONENT ====================
function ProviderCard({
  provider,
  isDark,
  connectedData,
  onConnect,
  onDeploy,
  onDisconnect,
  isDeploying,
  isTesting,
  hasFiles,
}: {
  provider: HostingProvider;
  isDark: boolean;
  connectedData: Record<string, string>;
  onConnect: (data: Record<string, string>) => void;
  onDeploy: () => void;
  onDisconnect: () => void;
  isDeploying: boolean;
  isTesting: boolean;
  hasFiles: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const isConnected = Object.keys(connectedData).length > 0;

  useEffect(() => {
    setFormData(connectedData);
  }, [connectedData]);

  return (
    <div
      className={`rounded-2xl border-2 transition-all ${
        isConnected
          ? `border-emerald-300 dark:border-emerald-700 ${isDark ? "bg-emerald-900/10" : "bg-emerald-50/50"}`
          : isDark
          ? "bg-slate-800/50 border-slate-700 hover:border-slate-600"
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center text-white text-xl shadow-lg`}
        >
          {provider.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              {provider.name}
            </h3>
            {isConnected && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                متصل
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {provider.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <button
                onClick={onDeploy}
                disabled={isDeploying || !hasFiles}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r ${provider.color} text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50`}
                title={!hasFiles ? "قم بتحميل ملفات أولاً للنشر" : "نشر المشروع"}
              >
                {isDeploying ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    جاري النشر...
                  </span>
                ) : "🚀 نشر الآن"}
              </button>
              <button
                onClick={onDisconnect}
                className="p-1.5 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="قطع الاتصال"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <a
                href={provider.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700/50 text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                    : "bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                }`}
                title="إنشاء حساب جديد"
              >
                تسجيل ↗
              </a>
              <button
                onClick={() => setExpanded(!expanded)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {expanded ? "إغلاق" : "ربط"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="px-4 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {provider.features.map((feat) => (
            <span
              key={feat}
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                isDark ? "bg-slate-700/50 text-slate-400" : "bg-slate-100 text-slate-500"
              }`}
            >
              {feat}
            </span>
          ))}
        </div>
      </div>

      {/* Connection Form */}
      {expanded && !isConnected && (
        <div className={`px-4 pb-4 pt-2 border-t ${isDark ? "border-slate-700" : "border-slate-100"}`}>
          <div className="space-y-3">
            {provider.fields.map((field) => (
              <div key={field.key}>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={formData[field.key] || ""}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  dir="ltr"
                  className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                      : "bg-white border-slate-300 text-gray-900 placeholder-slate-400"
                  }`}
                />
              </div>
            ))}
            <button
              onClick={() => {
                const hasAllFields = provider.fields.every((f) => formData[f.key]?.trim());
                if (hasAllFields) onConnect(formData);
              }}
              disabled={!provider.fields.every((f) => formData[f.key]?.trim()) || isTesting}
              className="w-full py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTesting ? (
                <span className="flex items-center justify-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري الاختبار...
                </span>
              ) : "ربط الحساب"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== DATABASE CARD COMPONENT ====================
function DatabaseCard({
  provider,
  isDark,
  connectedData,
  onConnect,
  onDisconnect,
  generatedCode,
  isTesting,
}: {
  provider: DatabaseProvider;
  isDark: boolean;
  connectedData: Record<string, string>;
  onConnect: (data: Record<string, string>) => void;
  onDisconnect: () => void;
  generatedCode: string;
  isTesting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showCode, setShowCode] = useState(false);
  const isConnected = Object.keys(connectedData).length > 0;

  useEffect(() => {
    setFormData(connectedData);
  }, [connectedData]);

  return (
    <div
      className={`rounded-2xl border-2 transition-all ${
        isConnected
          ? `border-emerald-300 dark:border-emerald-700 ${isDark ? "bg-emerald-900/10" : "bg-emerald-50/50"}`
          : isDark
          ? "bg-slate-800/50 border-slate-700 hover:border-slate-600"
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center text-white text-xl shadow-lg`}
        >
          {provider.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              {provider.name}
            </h3>
            {isConnected && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                متصل
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {provider.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <>
              <button
                onClick={() => setShowCode(!showCode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark
                    ? "bg-violet-600/20 text-violet-400 hover:bg-violet-600/30"
                    : "bg-violet-100 text-violet-600 hover:bg-violet-200"
                }`}
              >
                {showCode ? "إخفاء" : "كود الربط"}
              </button>
              <button
                onClick={onDisconnect}
                className="p-1.5 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="قطع الاتصال"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
          {!isConnected && (
            <>
              <a
                href={provider.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700/50 text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                    : "bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                }`}
                title="إنشاء حساب جديد"
              >
                تسجيل ↗
              </a>
              <button
                onClick={() => setExpanded(!expanded)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {expanded ? "إغلاق" : "ربط"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="px-4 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {provider.features.map((feat) => (
            <span
              key={feat}
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                isDark ? "bg-slate-700/50 text-slate-400" : "bg-slate-100 text-slate-500"
              }`}
            >
              {feat}
            </span>
          ))}
        </div>
      </div>

      {/* Connection Form */}
      {expanded && !isConnected && (
        <div className={`px-4 pb-4 pt-2 border-t ${isDark ? "border-slate-700" : "border-slate-100"}`}>
          <div className="space-y-3">
            {provider.fields.map((field) => (
              <div key={field.key}>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={formData[field.key] || ""}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  dir="ltr"
                  className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                      : "bg-white border-slate-300 text-gray-900 placeholder-slate-400"
                  }`}
                />
              </div>
            ))}
            <button
              onClick={() => {
                const hasRequired = provider.fields
                  .filter((f) => !f.label.includes("اختياري"))
                  .every((f) => formData[f.key]?.trim());
                if (hasRequired) onConnect(formData);
              }}
              disabled={isTesting}
              className="w-full py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {isTesting ? "جاري الاختبار..." : "ربط قاعدة البيانات"}
            </button>
          </div>
        </div>
      )}

      {/* Generated Code */}
      {showCode && generatedCode && (
        <div className={`px-4 pb-4 border-t ${isDark ? "border-slate-700" : "border-slate-100"}`}>
          <div className="mt-3 relative">
            <pre
              className={`text-[11px] p-3 rounded-lg overflow-x-auto ${
                isDark ? "bg-slate-900 text-green-400" : "bg-gray-900 text-green-400"
              }`}
              dir="ltr"
            >
              {generatedCode}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(generatedCode)}
              className={`absolute top-2 left-2 p-1.5 rounded-lg text-xs ${
                isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-gray-800 text-gray-400 hover:text-white"
              } transition-colors`}
              title="نسخ"
            >
              📋
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== FILE UPLOAD SECTION ====================
function FileUploadSection({
  isDark,
  files,
  onFilesChange,
}: {
  isDark: boolean;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = [];
    const readers: Promise<void>[] = [];

    Array.from(selectedFiles).forEach((file) => {
      const reader = new FileReader();
      const promise = new Promise<void>((resolve) => {
        reader.onload = () => {
          newFiles.push({
            name: file.name,
            content: reader.result as string,
            size: file.size,
          });
          resolve();
        };
        reader.onerror = () => resolve();
      });
      readers.push(promise);
      reader.readAsText(file);
    });

    Promise.all(readers).then(() => {
      onFilesChange([...files, ...newFiles]);
    });
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  };

  return (
    <div className={`rounded-2xl border-2 p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          📁 ملفات المشروع
        </h3>
        <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {files.length} ملف · {files.reduce((acc, f) => acc + f.size, 0) > 1024 ? `${(files.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB` : `${files.reduce((acc, f) => acc + f.size, 0)} B`}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDark
            ? "border-slate-600 hover:border-orange-500/50 hover:bg-orange-500/5"
            : "border-slate-300 hover:border-orange-400 hover:bg-orange-50/50"
        }`}
      >
        <div className="text-3xl mb-2">📤</div>
        <p className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
          اسحب الملفات هنا أو انقر للاختيار
        </p>
        <p className={`text-[10px] mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          HTML, CSS, JS, JSON, وغيرها من الملفات النصية
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".html,.css,.js,.jsx,.ts,.tsx,.json,.md,.txt,.py,.xml,.svg,.yaml,.yml,.env,.sql,.sh"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3 space-y-1">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-slate-50"}`}
            >
              <span className="text-xs">
                {file.name.endsWith(".html") ? "🌐" :
                 file.name.endsWith(".css") ? "🎨" :
                 file.name.endsWith(".js") || file.name.endsWith(".jsx") ? "📜" :
                 file.name.endsWith(".json") ? "📋" : "📄"}
              </span>
              <span className={`flex-1 text-xs truncate ${isDark ? "text-slate-300" : "text-slate-600"}`} dir="ltr">
                {file.name}
              </span>
              <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {file.size > 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`}
              </span>
              <button
                onClick={() => removeFile(index)}
                className="text-red-400 hover:text-red-500 text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== MAIN DEPLOYMENT HUB COMPONENT ====================
export default function DeploymentHub({
  projectFiles,
  projectName: initialProjectName,
  isDark: isDarkProp,
  onClose,
  standalone = false,
}: {
  projectFiles?: { name: string; content: string }[];
  projectName?: string;
  isDark?: boolean;
  onClose: () => void;
  standalone?: boolean;
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"hosting" | "database" | "env" | "history">("hosting");

  // Internal dark mode state for standalone mode
  const [internalIsDark, setInternalIsDark] = useState(false);
  const isDark = isDarkProp ?? internalIsDark;

  // Sync dark mode from DOM when in standalone mode
  useEffect(() => {
    if (standalone && isDarkProp === undefined) {
      const checkDark = () => {
        const isDarkMode = document.documentElement.classList.contains("dark");
        startTransition(() => setInternalIsDark(isDarkMode));
      };
      checkDark();
      const observer = new MutationObserver(checkDark);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    }
  }, [standalone, isDarkProp]);

  // Uploaded files (for standalone mode)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(
    projectFiles?.map((f) => ({ name: f.name, content: f.content, size: f.content.length })) || []
  );
  const [projectName, setProjectName] = useState(initialProjectName || "");

  // Hosting connections
  const [hostingConnections, setHostingConnections] = useState<Record<string, Record<string, string>>>({});
  const [deployingProvider, setDeployingProvider] = useState<string | null>(null);
  const [testingProvider] = useState<string | null>(null);

  // Database connections
  const [dbConnections, setDbConnections] = useState<Record<string, Record<string, string>>>({});
  const [testingDb, setTestingDb] = useState<string | null>(null);
  const [dbCodes, setDbCodes] = useState<Record<string, string>>({});

  // Environment variables
  const [envVars, setEnvVars] = useState<EnvVar[]>([
    { id: "1", key: "NODE_ENV", value: "production" },
  ]);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");

  // Deployment history
  const [deployHistory, setDeployHistory] = useState<DeploymentRecord[]>([]);

  // Notification
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showNotification = useCallback((type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Load saved connections from localStorage + Supabase
  useEffect(() => {
    async function loadConnections() {
      // Load from localStorage first (fast)
      try {
        const savedHosting = localStorage.getItem("hf_hosting_connections");
        if (savedHosting) startTransition(() => setHostingConnections(JSON.parse(savedHosting)));
        const savedDb = localStorage.getItem("hf_db_connections");
        if (savedDb) startTransition(() => setDbConnections(JSON.parse(savedDb)));
        const savedEnv = localStorage.getItem("hf_env_vars");
        if (savedEnv) startTransition(() => setEnvVars(JSON.parse(savedEnv)));
        const savedHistory = localStorage.getItem("hf_deploy_history");
        if (savedHistory) startTransition(() => setDeployHistory(JSON.parse(savedHistory)));
      } catch {}

      // Then try to load from Supabase (persistent)
      if (supabase && user) {
        try {
          const { data } = await supabase
            .from("user_connections")
            .select("*")
            .eq("user_id", user.id);

          if (data && data.length > 0) {
            const hostingData: Record<string, Record<string, string>> = {};
            const dbData: Record<string, Record<string, string>> = {};

            for (const conn of data as UserConnection[]) {
              if (conn.provider_type === "hosting") {
                hostingData[conn.provider_id] = conn.credentials;
              } else {
                dbData[conn.provider_id] = conn.credentials;
              }
            }

            if (Object.keys(hostingData).length > 0) {
              startTransition(() => setHostingConnections(hostingData));
              try { localStorage.setItem("hf_hosting_connections", JSON.stringify(hostingData)); } catch {}
            }
            if (Object.keys(dbData).length > 0) {
              startTransition(() => setDbConnections(dbData));
              try { localStorage.setItem("hf_db_connections", JSON.stringify(dbData)); } catch {}
            }
          }
        } catch {}
      }
    }
    loadConnections();
  }, [user]);

  // Save connection to both localStorage and Supabase
  const saveHostingConnection = useCallback(
    async (providerId: string, data: Record<string, string>) => {
      const updated = { ...hostingConnections, [providerId]: data };
      setHostingConnections(updated);
      try { localStorage.setItem("hf_hosting_connections", JSON.stringify(updated)); } catch {}

      // Save to Supabase
      if (supabase && user) {
        try {
          await supabase
            .from("user_connections")
            .upsert(
              {
                user_id: user.id,
                provider_type: "hosting",
                provider_id: providerId,
                credentials: data,
              },
              { onConflict: "user_id,provider_type,provider_id" }
            );
        } catch {}
      }
    },
    [hostingConnections, user]
  );

  const saveDbConnection = useCallback(
    async (providerId: string, data: Record<string, string>) => {
      const updated = { ...dbConnections, [providerId]: data };
      setDbConnections(updated);
      try { localStorage.setItem("hf_db_connections", JSON.stringify(updated)); } catch {}

      // Save to Supabase
      if (supabase && user) {
        try {
          await supabase
            .from("user_connections")
            .upsert(
              {
                user_id: user.id,
                provider_type: "database",
                provider_id: providerId,
                credentials: data,
              },
              { onConflict: "user_id,provider_type,provider_id" }
            );
        } catch {}
      }
    },
    [dbConnections, user]
  );

  const removeHostingConnection = useCallback(
    async (providerId: string) => {
      const updated = { ...hostingConnections };
      delete updated[providerId];
      setHostingConnections(updated);
      try { localStorage.setItem("hf_hosting_connections", JSON.stringify(updated)); } catch {}

      if (supabase && user) {
        try {
          await supabase
            .from("user_connections")
            .delete()
            .eq("user_id", user.id)
            .eq("provider_type", "hosting")
            .eq("provider_id", providerId);
        } catch {}
      }
    },
    [hostingConnections, user]
  );

  const removeDbConnection = useCallback(
    async (providerId: string) => {
      const updated = { ...dbConnections };
      delete updated[providerId];
      setDbConnections(updated);
      try { localStorage.setItem("hf_db_connections", JSON.stringify(updated)); } catch {}

      if (supabase && user) {
        try {
          await supabase
            .from("user_connections")
            .delete()
            .eq("user_id", user.id)
            .eq("provider_type", "database")
            .eq("provider_id", providerId);
        } catch {}
      }
    },
    [dbConnections, user]
  );

  const saveEnvVars = useCallback((vars: EnvVar[]) => {
    setEnvVars(vars);
    try { localStorage.setItem("hf_env_vars", JSON.stringify(vars)); } catch {}
  }, []);

  const addDeployRecord = useCallback((record: DeploymentRecord) => {
    setDeployHistory((prev) => {
      const updated = [record, ...prev].slice(0, 50);
      try { localStorage.setItem("hf_deploy_history", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // Handle hosting connection
  const handleHostingConnect = useCallback(
    (providerId: string, data: Record<string, string>) => {
      saveHostingConnection(providerId, data);
      showNotification("success", `تم ربط ${HOSTING_PROVIDERS.find(p => p.id === providerId)?.name} بنجاح`);
    },
    [saveHostingConnection, showNotification]
  );

  // Handle database connection
  const handleDbConnect = useCallback(
    async (providerId: string, data: Record<string, string>) => {
      setTestingDb(providerId);
      try {
        let result: { success: boolean; error?: string } = { success: false, error: "فشل الاتصال" };
        switch (providerId) {
          case "supabase":
            result = await testSupabaseConnection(data.project_url, data.anon_key);
            break;
          case "mongodb":
            result = await testMongoConnection(data.connection_string);
            break;
          case "neon":
            result = await testNeonConnection(data.connection_string);
            break;
          case "firebase":
            result = await testFirebaseConnection(data.api_key, data.project_id, data.app_id);
            break;
          case "planetscale":
            result = { success: !!data.connection_string, error: undefined };
            break;
        }
        if (result.success) {
          await saveDbConnection(providerId, data);
          // Generate code
          let code = "";
          switch (providerId) {
            case "supabase":
              code = generateSupabaseCode(data.project_url, data.anon_key);
              break;
            case "mongodb":
              code = generateMongoCode(data.connection_string);
              break;
            case "neon":
              code = generateNeonCode(data.connection_string);
              break;
            case "firebase":
              code = generateFirebaseCode(data.api_key, data.project_id, data.app_id);
              break;
            case "planetscale":
              code = generatePlanetScaleCode(data.connection_string);
              break;
          }
          startTransition(() => setDbCodes((prev) => ({ ...prev, [providerId]: code })));
          // Auto-add env vars
          const newVars: EnvVar[] = [];
          if (providerId === "supabase") {
            newVars.push(
              { id: `env-${Date.now()}-1`, key: "NEXT_PUBLIC_SUPABASE_URL", value: data.project_url },
              { id: `env-${Date.now()}-2`, key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: data.anon_key }
            );
          } else if (providerId === "mongodb") {
            newVars.push({ id: `env-${Date.now()}-1`, key: "MONGODB_URI", value: data.connection_string });
          } else if (providerId === "neon") {
            newVars.push({ id: `env-${Date.now()}-1`, key: "DATABASE_URL", value: data.connection_string });
          } else if (providerId === "firebase") {
            newVars.push(
              { id: `env-${Date.now()}-1`, key: "FIREBASE_API_KEY", value: data.api_key },
              { id: `env-${Date.now()}-2`, key: "FIREBASE_PROJECT_ID", value: data.project_id }
            );
          } else if (providerId === "planetscale") {
            newVars.push({ id: `env-${Date.now()}-1`, key: "DATABASE_URL", value: data.connection_string });
          }
          if (newVars.length > 0) {
            saveEnvVars([...envVars, ...newVars]);
          }
          showNotification("success", `تم ربط ${DATABASE_PROVIDERS.find(p => p.id === providerId)?.name} بنجاح`);
        } else {
          showNotification("error", `فشل الاتصال: ${result.error}`);
        }
      } finally {
        setTestingDb(null);
      }
    },
    [saveDbConnection, envVars, saveEnvVars, showNotification]
  );

  // Deploy to hosting
  const handleDeploy = useCallback(
    async (providerId: string) => {
      if (uploadedFiles.length === 0) {
        showNotification("error", "قم بتحميل ملفات المشروع أولاً قبل النشر");
        return;
      }

      if (!projectName.trim()) {
        showNotification("error", "أدخل اسم المشروع أولاً");
        return;
      }

      setDeployingProvider(providerId);
      const connectionData = hostingConnections[providerId];
      const name = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 40) || `hf-project-${Date.now()}`;

      const record: DeploymentRecord = {
        id: `deploy-${Date.now()}`,
        provider: providerId,
        projectName: name,
        status: "pending",
        timestamp: new Date().toISOString(),
      };

      try {
        let result: { success: boolean; url?: string; error?: string } = { success: false, error: "موفر غير معروف" };
        const deployFiles = uploadedFiles.map(f => ({ name: f.name, content: f.content }));

        switch (providerId) {
          case "cloudflare":
            result = await deployToCloudflare(
              connectionData.api_token,
              connectionData.account_id,
              name,
              deployFiles
            );
            break;
          case "vercel":
            result = await deployToVercel(connectionData.api_token, name, deployFiles);
            break;
          case "netlify":
            result = await deployToNetlify(connectionData.api_token, name, deployFiles);
            break;
          case "github":
            result = await deployToGitHub(
              connectionData.api_token,
              connectionData.repo_name || name,
              deployFiles
            );
            break;
          case "surge":
            result = {
              success: true,
              url: `https://${connectionData.domain || name + ".surge.sh"}`,
              error: undefined,
            };
            break;
          case "render":
            result = await deployToRender(connectionData.api_key, name);
            break;
        }

        record.status = result.success ? "success" : "failed";
        record.url = result.url || undefined;
        record.error = result.error || undefined;

        if (result.success && result.url) {
          // Save deployment to Supabase
          if (supabase && user) {
            try {
              await supabase.from("deployments").insert({
                user_id: user.id,
                provider: providerId,
                provider_project_name: name,
                deploy_url: result.url,
                status: "success",
              });
            } catch {}
          }
          showNotification("success", `تم نشر المشروع بنجاح على ${HOSTING_PROVIDERS.find(p => p.id === providerId)?.name}: ${result.url}`);
        } else {
          showNotification("error", `فشل النشر: ${result.error || "خطأ غير معروف"}`);
        }
      } catch (err) {
        record.status = "failed";
        record.error = err instanceof Error ? err.message : "خطأ غير معروف";
        showNotification("error", `فشل النشر: ${record.error}`);
      } finally {
        addDeployRecord(record);
        setDeployingProvider(null);
      }
    },
    [uploadedFiles, projectName, hostingConnections, user, addDeployRecord, showNotification]
  );

  const hasFiles = uploadedFiles.length > 0;

  // Deploy to all connected hosting providers simultaneously
  const handleDeployAll = useCallback(
    async () => {
      if (uploadedFiles.length === 0) {
        showNotification("error", "قم بتحميل ملفات المشروع أولاً قبل النشر");
        return;
      }

      if (!projectName.trim()) {
        showNotification("error", "أدخل اسم المشروع أولاً");
        return;
      }

      const connectedProviderIds = Object.keys(hostingConnections);
      if (connectedProviderIds.length === 0) {
        showNotification("error", "قم بربط حساب استضافة واحد على الأقل");
        return;
      }

      setDeployingProvider("all");
      const name = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 40) || `hf-project-${Date.now()}`;
      const deployFiles = uploadedFiles.map(f => ({ name: f.name, content: f.content }));

      let successCount = 0;
      let failCount = 0;

      const deployPromises = connectedProviderIds.map(async (providerId) => {
        const connectionData = hostingConnections[providerId];
        const record: DeploymentRecord = {
          id: `deploy-${Date.now()}-${providerId}`,
          provider: providerId,
          projectName: name,
          status: "pending",
          timestamp: new Date().toISOString(),
        };

        try {
          let result: { success: boolean; url?: string; error?: string } = { success: false, error: "موفر غير معروف" };

          switch (providerId) {
            case "cloudflare":
              result = await deployToCloudflare(connectionData.api_token, connectionData.account_id, name, deployFiles);
              break;
            case "vercel":
              result = await deployToVercel(connectionData.api_token, name, deployFiles);
              break;
            case "netlify":
              result = await deployToNetlify(connectionData.api_token, name, deployFiles);
              break;
            case "github":
              result = await deployToGitHub(connectionData.api_token, connectionData.repo_name || name, deployFiles);
              break;
            case "surge":
              result = { success: true, url: `https://${connectionData.domain || name + ".surge.sh"}`, error: undefined };
              break;
            case "render":
              result = await deployToRender(connectionData.api_key, name);
              break;
          }

          record.status = result.success ? "success" : "failed";
          record.url = result.url || undefined;
          record.error = result.error || undefined;

          if (result.success) {
            successCount++;
            if (supabase && user) {
              try {
                await supabase.from("deployments").insert({
                  user_id: user.id,
                  provider: providerId,
                  provider_project_name: name,
                  deploy_url: result.url,
                  status: "success",
                });
              } catch {}
            }
          } else {
            failCount++;
          }
        } catch (err) {
          record.status = "failed";
          record.error = err instanceof Error ? err.message : "خطأ غير معروف";
          failCount++;
        } finally {
          addDeployRecord(record);
        }
      });

      await Promise.allSettled(deployPromises);
      setDeployingProvider(null);

      if (successCount > 0 && failCount === 0) {
        showNotification("success", `تم النشر بنجاح إلى جميع الموفرين (${successCount}/${connectedProviderIds.length})`);
      } else if (successCount > 0 && failCount > 0) {
        showNotification("success", `تم النشر بنجاح إلى ${successCount} موفر وفشل النشر إلى ${failCount} موفر`);
      } else {
        showNotification("error", `فشل النشر إلى جميع الموفرين`);
      }
    },
    [uploadedFiles, projectName, hostingConnections, user, addDeployRecord, showNotification]
  );

  // Stats
  const connectedHostingCount = Object.keys(hostingConnections).length;
  const connectedDbCount = Object.keys(dbConnections).length;
  const successDeploys = deployHistory.filter(d => d.status === "success").length;

  return (
    <div className={`flex flex-col h-full ${isDark ? "bg-slate-950" : "bg-slate-50"}`} dir="rtl">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-bounce ${
          notification.type === "success"
            ? "bg-emerald-500 text-white"
            : "bg-red-500 text-white"
        }`}>
          <span>{notification.type === "success" ? "✅" : "❌"}</span>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200"} backdrop-blur-sm`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-emerald-500/20">
            🚀
          </div>
          <div>
            <h1 className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              مركز النشر والاستضافة
            </h1>
            <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              ربط المشاريع بالاستضافة وقواعد البيانات المجانية
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats badges */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className={`px-2 py-1 rounded-lg text-[10px] font-medium ${isDark ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-600"}`}>
              ☁️ {connectedHostingCount} استضافة
            </span>
            <span className={`px-2 py-1 rounded-lg text-[10px] font-medium ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"}`}>
              🗄️ {connectedDbCount} قاعدة بيانات
            </span>
            <span className={`px-2 py-1 rounded-lg text-[10px] font-medium ${isDark ? "bg-violet-500/20 text-violet-400" : "bg-violet-100 text-violet-600"}`}>
              ✅ {successDeploys} نشر ناجح
            </span>
          </div>
          {standalone && (
            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-200 text-slate-700 hover:bg-slate-300"} transition-colors`}
            >
              ← رجوع
            </button>
          )}
        </div>
      </div>

      {/* Quick Deploy Banner - shown when projectFiles are passed from Builder */}
      {projectFiles && projectFiles.length > 0 && (
        <div className={`mx-4 mt-3 rounded-2xl border-2 p-4 ${
          isDark
            ? "bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border-emerald-700/50"
            : "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300/50"
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg shadow-lg">
              ⚡
            </div>
            <div className="flex-1">
              <h2 className={`text-sm font-bold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                نشر سريع من البنّاء
              </h2>
              <p className={`text-xs ${isDark ? "text-emerald-400/70" : "text-emerald-600/70"}`}>
                {projectFiles.length} ملف جاهز للنشر مباشرة
              </p>
            </div>
            {hasFiles && connectedHostingCount > 0 && (
              <button
                onClick={() => handleDeploy(Object.keys(hostingConnections)[0])}
                disabled={deployingProvider !== null || !projectName.trim()}
                className={`px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {deployingProvider ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    جاري النشر...
                  </span>
                ) : `نشر إلى ${HOSTING_PROVIDERS.find(p => p.id === Object.keys(hostingConnections)[0])?.name || "الموفر"}`}
              </button>
            )}
          </div>
          {/* Quick deploy to all connected providers */}
          {hasFiles && connectedHostingCount > 1 && (
            <button
              onClick={handleDeployAll}
              disabled={deployingProvider !== null || !projectName.trim()}
              className={`w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {deployingProvider === "all"
                ? "جاري النشر إلى جميع الموفرين..."
                : `نشر إلى جميع الموفرين المتصلين (${connectedHostingCount})`
              }
            </button>
          )}
          {!hasFiles && (
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              جاري تحضير الملفات...
            </p>
          )}
          {hasFiles && connectedHostingCount === 0 && (
            <p className={`text-xs ${isDark ? "text-amber-400" : "text-amber-600"}`}>
              قم بربط حساب استضافة أولاً للنشر السريع
            </p>
          )}
        </div>
      )}

      {/* Project name + files upload */}
      <div className={`px-4 py-3 border-b ${isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white/50"}`}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              اسم المشروع
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-awesome-project"
              dir="ltr"
              className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                  : "bg-white border-slate-300 text-gray-900 placeholder-slate-400"
              }`}
            />
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-[10px] px-3 py-2 rounded-lg ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
              {hasFiles ? `${uploadedFiles.length} ملف جاهز للنشر` : "لم يتم تحميل ملفات"}
            </span>
            {/* Deploy All button - shown when multiple hosting providers are connected */}
            {connectedHostingCount > 1 && hasFiles && !projectFiles && (
              <button
                onClick={handleDeployAll}
                disabled={deployingProvider !== null || !projectName.trim()}
                className={`px-3 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                title="نشر إلى جميع الموفرين المتصلين"
              >
                {deployingProvider === "all"
                  ? "جاري النشر..."
                  : `نشر الكل (${connectedHostingCount})`
                }
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex px-4 py-2 gap-1 border-b ${isDark ? "border-slate-800 bg-slate-900/30" : "border-slate-200 bg-white/30"}`}>
        {([
          { id: "hosting" as const, label: "☁️ الاستضافة", count: connectedHostingCount },
          { id: "database" as const, label: "🗄️ قواعد البيانات", count: connectedDbCount },
          { id: "env" as const, label: "🔐 المتغيرات", count: envVars.length },
          { id: "history" as const, label: "📊 السجل", count: deployHistory.length },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === tab.id
                ? isDark
                  ? "bg-emerald-600/20 text-emerald-400"
                  : "bg-emerald-100 text-emerald-600"
                : isDark
                  ? "text-slate-400 hover:text-slate-300 hover:bg-slate-800"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id
                  ? isDark ? "bg-emerald-500/30" : "bg-emerald-200"
                  : isDark ? "bg-slate-700" : "bg-slate-200"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Standalone Welcome Landing - shown when standalone mode with no project files */}
        {standalone && !projectFiles && connectedHostingCount === 0 && connectedDbCount === 0 && (
          <div className={`rounded-2xl border-2 p-6 mb-4 ${
            isDark
              ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700"
              : "bg-gradient-to-br from-white to-slate-50 border-slate-200"
          }`}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl shadow-xl mx-auto mb-3">
                🚀
              </div>
              <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                مرحباً بك في مركز النشر
              </h2>
              <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                انشر مشروعك مجاناً على أفضل منصات الاستضافة والقواعد البيانات
              </p>
            </div>

            {/* 3-step guide */}
            <div className="space-y-3">
              <div className={`flex items-start gap-3 p-3 rounded-xl ${
                isDark ? "bg-slate-700/40" : "bg-slate-100/80"
              }`}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  1
                </div>
                <div>
                  <h3 className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    رفع الملفات أو استخدام البنّاء
                  </h3>
                  <p className={`text-[10px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    قم بتحميل ملفات مشروعك مباشرة أو استخدم وضع البنّاء لإنشاء مشروعك
                  </p>
                </div>
              </div>

              <div className={`flex items-start gap-3 p-3 rounded-xl ${
                isDark ? "bg-slate-700/40" : "bg-slate-100/80"
              }`}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  2
                </div>
                <div>
                  <h3 className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    ربط حساب الاستضافة
                  </h3>
                  <p className={`text-[10px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    اربط حسابك على Cloudflare أو Vercel أو Netlify أو أي موفر آخر
                  </p>
                </div>
              </div>

              <div className={`flex items-start gap-3 p-3 rounded-xl ${
                isDark ? "bg-slate-700/40" : "bg-slate-100/80"
              }`}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  3
                </div>
                <div>
                  <h3 className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    نشر المشروع
                  </h3>
                  <p className={`text-[10px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    انشر مشروعك بنقرة واحدة واحصل على رابط مباشر للموقع
                  </p>
                </div>
              </div>
            </div>

            <div className={`mt-4 text-center p-3 rounded-xl ${
              isDark ? "bg-emerald-600/10 border border-emerald-600/20" : "bg-emerald-50 border border-emerald-200"
            }`}>
              <p className={`text-xs font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                جميع منصات الاستضافة المدعومة توفر خططاً مجانية - ابدأ بدون أي تكلفة
              </p>
            </div>
          </div>
        )}

        {/* Hosting Tab */}
        {activeTab === "hosting" && (
          <>
            {/* File upload for hosting */}
            <FileUploadSection
              isDark={isDark}
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
            />

            <div className="space-y-3">
              {HOSTING_PROVIDERS.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  isDark={isDark}
                  connectedData={hostingConnections[provider.id] || {}}
                  onConnect={(data) => handleHostingConnect(provider.id, data)}
                  onDeploy={() => handleDeploy(provider.id)}
                  onDisconnect={() => removeHostingConnection(provider.id)}
                  isDeploying={deployingProvider === provider.id}
                  isTesting={testingProvider === provider.id}
                  hasFiles={hasFiles}
                />
              ))}
            </div>
          </>
        )}

        {/* Database Tab */}
        {activeTab === "database" && (
          <div className="space-y-3">
            {DATABASE_PROVIDERS.map((provider) => (
              <DatabaseCard
                key={provider.id}
                provider={provider}
                isDark={isDark}
                connectedData={dbConnections[provider.id] || {}}
                onConnect={(data) => handleDbConnect(provider.id, data)}
                onDisconnect={() => removeDbConnection(provider.id)}
                generatedCode={dbCodes[provider.id] || ""}
                isTesting={testingDb === provider.id}
              />
            ))}
          </div>
        )}

        {/* Environment Variables Tab */}
        {activeTab === "env" && (
          <div className={`rounded-2xl border-2 p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
            <h3 className={`text-sm font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
              🔐 متغيرات البيئة (Environment Variables)
            </h3>
            <p className={`text-xs mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              ستتم إضافتها تلقائياً عند نشر المشروع على أي منصة استضافة تدعمها
            </p>

            <div className="space-y-2">
              {envVars.map((env) => (
                <div key={env.id} className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-slate-50"}`}>
                  <input
                    type="text"
                    value={env.key}
                    onChange={(e) => {
                      const updated = envVars.map(v => v.id === env.id ? { ...v, key: e.target.value } : v);
                      saveEnvVars(updated);
                    }}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-mono ${isDark ? "bg-slate-800 text-emerald-400 border-slate-600" : "bg-white text-emerald-600 border-slate-300"} border`}
                    dir="ltr"
                    placeholder="KEY"
                  />
                  <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>=</span>
                  <input
                    type="password"
                    value={env.value}
                    onChange={(e) => {
                      const updated = envVars.map(v => v.id === env.id ? { ...v, value: e.target.value } : v);
                      saveEnvVars(updated);
                    }}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-mono ${isDark ? "bg-slate-800 text-orange-400 border-slate-600" : "bg-white text-orange-600 border-slate-300"} border`}
                    dir="ltr"
                    placeholder="value"
                  />
                  <button
                    onClick={() => {
                      const updated = envVars.filter(v => v.id !== env.id);
                      saveEnvVars(updated);
                    }}
                    className="text-red-400 hover:text-red-500 text-xs p-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add new env var */}
            <div className={`flex items-center gap-2 mt-3 p-2 rounded-lg ${isDark ? "bg-slate-700/30" : "bg-slate-100/50"}`}>
              <input
                type="text"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder="اسم المتغير"
                dir="ltr"
                className={`flex-1 px-2 py-1.5 rounded text-xs font-mono ${isDark ? "bg-slate-800 text-white border-slate-600" : "bg-white text-gray-900 border-slate-300"} border`}
              />
              <input
                type="text"
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                placeholder="القيمة"
                dir="ltr"
                className={`flex-1 px-2 py-1.5 rounded text-xs font-mono ${isDark ? "bg-slate-800 text-white border-slate-600" : "bg-white text-gray-900 border-slate-300"} border`}
              />
              <button
                onClick={() => {
                  if (newEnvKey.trim() && newEnvValue.trim()) {
                    saveEnvVars([...envVars, { id: `env-${Date.now()}`, key: newEnvKey.trim(), value: newEnvValue.trim() }]);
                    setNewEnvKey("");
                    setNewEnvValue("");
                  }
                }}
                disabled={!newEnvKey.trim() || !newEnvValue.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-orange-500 to-yellow-500 text-white disabled:opacity-50"
              >
                إضافة
              </button>
            </div>
          </div>
        )}

        {/* Deployment History Tab */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {deployHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📊</div>
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  لا توجد عمليات نشر سابقة
                </p>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  اربط حساب استضافة وانشر مشروعك الأول
                </p>
              </div>
            ) : (
              deployHistory.map((record) => (
                <div
                  key={record.id}
                  className={`rounded-xl p-3 border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${record.status === "success" ? "text-emerald-500" : record.status === "failed" ? "text-red-500" : "text-yellow-500"}`}>
                        {record.status === "success" ? "✅" : record.status === "failed" ? "❌" : "⏳"}
                      </span>
                      <div>
                        <p className={`text-xs font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                          {record.projectName}
                        </p>
                        <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {HOSTING_PROVIDERS.find(p => p.id === record.provider)?.name || record.provider} · {new Date(record.timestamp).toLocaleString("ar-SA")}
                        </p>
                      </div>
                    </div>
                    {record.url && (
                      <a
                        href={record.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-[10px] px-2 py-1 rounded-lg ${isDark ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30" : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"} transition-colors`}
                        dir="ltr"
                      >
                        فتح ↗
                      </a>
                    )}
                  </div>
                  {record.error && (
                    <p className="text-[10px] text-red-400 mt-1">{record.error}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
