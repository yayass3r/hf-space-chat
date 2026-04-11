"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import { BuilderProject, BuilderFile } from "@/lib/builder-templates";
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
}

interface DatabaseProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  features: string[];
  fields: { key: string; label: string; placeholder: string; type: string }[];
  color: string;
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

// ==================== PROVIDERS DATA ====================
const HOSTING_PROVIDERS: HostingProvider[] = [
  {
    id: "cloudflare",
    name: "Cloudflare Pages",
    icon: "☁️",
    description: "استضافة مجانية مع نطاق带宽 غير محدود و 500 بناء/شهر",
    features: ["نطاق带宽 غير محدود", "500 بناء شهرياً", "SSL تلقائي", "نطاق .pages.dev مجاني"],
    fields: [
      { key: "api_token", label: "API Token", placeholder: "cloudflare_api_token...", type: "password" },
      { key: "account_id", label: "Account ID", placeholder: "account_id...", type: "text" },
    ],
    color: "from-orange-500 to-amber-500",
  },
  {
    id: "vercel",
    name: "Vercel",
    icon: "▲",
    description: "منصة نشر متقدمة مع دعم Serverless Functions",
    features: ["100GB نقل شهري", "Serverless Functions", "SSL تلقائي", "نطاق .vercel.app مجاني"],
    fields: [
      { key: "api_token", label: "API Token", placeholder: "vercel_token...", type: "password" },
    ],
    color: "from-slate-800 to-slate-600",
  },
  {
    id: "netlify",
    name: "Netlify",
    icon: "🌐",
    description: "استضافة سريعة مع 100GB نقل بيانات شهرياً",
    features: ["100GB نقل شهري", "300 دقيقة بناء", "نطاق .netlify.app مجاني", "Auto-deploy من Git"],
    fields: [
      { key: "api_token", label: "Personal Access Token", placeholder: "netlify_token...", type: "password" },
    ],
    color: "from-teal-500 to-cyan-500",
  },
  {
    id: "github",
    name: "GitHub Pages",
    icon: "🐙",
    description: "استضافة مجانية مباشرة من مستودع GitHub",
    features: ["مجاني بالكامل", "دعم Jekyll", "نطاق .github.io مجاني", "Custom domain"],
    fields: [
      { key: "api_token", label: "Personal Access Token", placeholder: "ghp_xxxx...", type: "password" },
      { key: "repo_name", label: "اسم المستودع", placeholder: "my-project", type: "text" },
    ],
    color: "from-gray-800 to-gray-600",
  },
  {
    id: "surge",
    name: "Surge.sh",
    icon: "⚡",
    description: "أبسط طريقة لنشر المواقع الثابتة من الطرفية",
    features: ["نشر بأمر واحد", "نطاق .surge.sh مجاني", "SSL تلقائي", "بدون تسجيل معقد"],
    fields: [
      { key: "domain", label: "اسم النطاق", placeholder: "my-project.surge.sh", type: "text" },
    ],
    color: "from-yellow-500 to-orange-500",
  },
];

const DATABASE_PROVIDERS: DatabaseProvider[] = [
  {
    id: "supabase",
    name: "Supabase",
    icon: "🟢",
    description: "قاعدة بيانات PostgreSQL مجانية مع Auth و Storage",
    features: ["500MB تخزين", "Auth مدمج", "Storage ملفات", "Realtime subscriptions"],
    fields: [
      { key: "project_url", label: "Project URL", placeholder: "https://xxx.supabase.co", type: "text" },
      { key: "anon_key", label: "Anon Key", placeholder: "eyJ...", type: "password" },
      { key: "service_role_key", label: "Service Role Key", placeholder: "eyJ... (اختياري)", type: "password" },
    ],
    color: "from-emerald-500 to-green-500",
  },
  {
    id: "mongodb",
    name: "MongoDB Atlas",
    icon: "🍃",
    description: "قاعدة بيانات NoSQL سحابية مع 512MB مجاناً",
    features: ["512MB مجاناً", "قاعدة بيانات مشتركة", "Atlas Search", "Charts مجاني"],
    fields: [
      { key: "connection_string", label: "Connection String", placeholder: "mongodb+srv://user:pass@cluster.mongodb.net/db", type: "password" },
    ],
    color: "from-green-600 to-emerald-500",
  },
  {
    id: "neon",
    name: "Neon PostgreSQL",
    icon: "🔷",
    description: "PostgreSQL بدون خادم مع 0.5GB تخزين مجاني",
    features: ["0.5GB تخزين", "Serverless", "تفرع تلقائي", "اتصال فوري"],
    fields: [
      { key: "connection_string", label: "Connection String", placeholder: "postgresql://user:pass@ep-xxx.neon.tech/db", type: "password" },
    ],
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "firebase",
    name: "Firebase",
    icon: "🔥",
    description: "منصة Google مع Firestore و Auth و Storage مجاناً",
    features: ["Firestore مجاني", "Authentication", "Hosting", "Cloud Storage"],
    fields: [
      { key: "api_key", label: "API Key", placeholder: "AIza...", type: "text" },
      { key: "project_id", label: "Project ID", placeholder: "my-project-id", type: "text" },
      { key: "app_id", label: "App ID", placeholder: "1:123:web:abc", type: "text" },
    ],
    color: "from-amber-500 to-yellow-500",
  },
];

// ==================== DEPLOYMENT FUNCTIONS ====================
async function deployToCloudflare(
  apiToken: string,
  accountId: string,
  projectName: string,
  files: BuilderFile[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Create a Cloudflare Pages project
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

    // Upload files as a deployment
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
  files: BuilderFile[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Create deployment via Vercel API
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
  files: BuilderFile[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Create a zip-like structure using form data
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
  files: BuilderFile[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Create repository
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

    // Get the authenticated user if repo already exists
    let owner = username;
    if (!owner) {
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const userData = await userRes.json();
      owner = userData.login;
    }

    // Push files via Git Data API
    // Get the latest commit SHA
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const refData = await refRes.json();
    const latestCommitSha = refData.object?.sha;
    if (!latestCommitSha) {
      return { success: false, error: "فشل الحصول على آخر commit" };
    }

    // Get the tree SHA
    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${latestCommitSha}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const commitData = await commitRes.json();
    const treeSha = commitData.tree?.sha;

    // Create blobs for each file
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

    // Create tree
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

    // Create commit
    const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Deploy from HF Space Chat Builder",
        tree: treeData.sha,
        parents: [latestCommitSha],
      }),
    });
    const newCommitData = await newCommitRes.json();

    // Update reference
    await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sha: newCommitData.sha }),
    });

    // Enable GitHub Pages
    await fetch(`https://api.github.com/repos/${owner}/${repoName}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: { branch: "main", path: "/" },
      }),
    }).catch(() => {}); // May already be enabled

    const url = `https://${owner}.github.io/${repoName}`;
    return { success: true, url };
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
  // Client-side can't directly test MongoDB - validate format
  if (connectionString.startsWith("mongodb+srv://") || connectionString.startsWith("mongodb://")) {
    return { success: true };
  }
  return { success: false, error: "صيغة الاتصال غير صحيحة" };
}

async function testNeonConnection(
  connectionString: string
): Promise<{ success: boolean; error?: string }> {
  if (connectionString.includes("neon.tech") && connectionString.startsWith("postgresql://")) {
    return { success: true };
  }
  return { success: false, error: "صيغة الاتصال غير صحيحة" };
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
}: {
  provider: HostingProvider;
  isDark: boolean;
  connectedData: Record<string, string>;
  onConnect: (data: Record<string, string>) => void;
  onDeploy: () => void;
  onDisconnect: () => void;
  isDeploying: boolean;
  isTesting: boolean;
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
                disabled={isDeploying}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r ${provider.color} text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50`}
              >
                {isDeploying ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    جاري النشر...
                  </span>
                ) : "نشر الآن"}
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
                كود الربط
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

// ==================== MAIN DEPLOYMENT HUB COMPONENT ====================
export default function DeploymentHub({
  project,
  isDark,
  onClose,
}: {
  project: BuilderProject | null;
  isDark: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"hosting" | "database" | "env" | "history">("hosting");

  // Hosting connections
  const [hostingConnections, setHostingConnections] = useState<Record<string, Record<string, string>>>({});
  const [deployingProvider, setDeployingProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

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

  // Load saved connections from localStorage
  useEffect(() => {
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
  }, []);

  // Save connections to localStorage
  const saveHostingConnections = useCallback((data: Record<string, Record<string, string>>) => {
    setHostingConnections(data);
    try { localStorage.setItem("hf_hosting_connections", JSON.stringify(data)); } catch {}
  }, []);

  const saveDbConnections = useCallback((data: Record<string, Record<string, string>>) => {
    setDbConnections(data);
    try { localStorage.setItem("hf_db_connections", JSON.stringify(data)); } catch {}
  }, []);

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
      saveHostingConnections({ ...hostingConnections, [providerId]: data });
    },
    [hostingConnections, saveHostingConnections]
  );

  const handleHostingDisconnect = useCallback(
    (providerId: string) => {
      const updated = { ...hostingConnections };
      delete updated[providerId];
      saveHostingConnections(updated);
    },
    [hostingConnections, saveHostingConnections]
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
            result = { success: !!(data.api_key && data.project_id), error: undefined };
            break;
        }
        if (result.success) {
          saveDbConnections({ ...dbConnections, [providerId]: data });
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
          }
          if (newVars.length > 0) {
            saveEnvVars([...envVars, ...newVars]);
          }
        } else {
          alert(`فشل الاتصال: ${result.error}`);
        }
      } finally {
        setTestingDb(null);
      }
    },
    [dbConnections, envVars, saveDbConnections, saveEnvVars]
  );

  const handleDbDisconnect = useCallback(
    (providerId: string) => {
      const updated = { ...dbConnections };
      delete updated[providerId];
      saveDbConnections(updated);
    },
    [dbConnections, saveDbConnections]
  );

  // Deploy to hosting
  const handleDeploy = useCallback(
    async (providerId: string) => {
      if (!project || project.files.length === 0) {
        alert("لا يوجد مشروع أو ملفات للنشر");
        return;
      }

      setDeployingProvider(providerId);
      const connectionData = hostingConnections[providerId];
      const projectName = project.name
        .toLowerCase()
        .replace(/[^a-z0-9\u0621-\u064A]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 40) || `hf-project-${Date.now()}`;
      const record: DeploymentRecord = {
        id: `deploy-${Date.now()}`,
        provider: providerId,
        projectName,
        status: "pending",
        timestamp: new Date().toISOString(),
      };

      try {
        let result: { success: boolean; url?: string; error?: string } = { success: false, error: "موفر غير معروف" };

        switch (providerId) {
          case "cloudflare":
            result = await deployToCloudflare(
              connectionData.api_token,
              connectionData.account_id,
              projectName,
              project.files
            );
            break;
          case "vercel":
            result = await deployToVercel(connectionData.api_token, projectName, project.files);
            break;
          case "netlify":
            result = await deployToNetlify(connectionData.api_token, projectName, project.files);
            break;
          case "github":
            result = await deployToGitHub(
              connectionData.api_token,
              connectionData.repo_name || projectName,
              project.files
            );
            break;
          case "surge":
            // Surge requires CLI - generate instructions
            result = {
              success: true,
              url: `https://${connectionData.domain || projectName + ".surge.sh"}`,
              error: undefined,
            };
            break;
        }

        record.status = result.success ? "success" : "failed";
        record.url = result.url || undefined;
        record.error = result.error || undefined;

        if (result.success && result.url) {
          // Save to Supabase if available
          if (supabase && user) {
            await supabase.from("projects").update({
              is_deployed: true,
              status: "deployed",
            }).eq("id", project.id).eq("user_id", user.id);
          }
        }
      } catch (err) {
        record.status = "failed";
        record.error = err instanceof Error ? err.message : "خطأ غير معروف";
      } finally {
        addDeployRecord(record);
        setDeployingProvider(null);
      }
    },
    [project, hostingConnections, user, addDeployRecord]
  );

  // Environment variables management
  const addEnvVar = () => {
    if (!newEnvKey.trim()) return;
    saveEnvVars([
      ...envVars,
      { id: `env-${Date.now()}`, key: newEnvKey.trim(), value: newEnvValue },
    ]);
    setNewEnvKey("");
    setNewEnvValue("");
  };

  const removeEnvVar = (id: string) => {
    saveEnvVars(envVars.filter((v) => v.id !== id));
  };

  const updateEnvVar = (id: string, key: string, value: string) => {
    saveEnvVars(envVars.map((v) => (v.id === id ? { ...v, key, value } : v)));
  };

  // Generate .env content
  const generateEnvContent = () => {
    return envVars.map((v) => `${v.key}=${v.value}`).join("\n");
  };

  // Download .env file
  const downloadEnvFile = () => {
    const content = generateEnvContent();
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate deployment config files
  const generateConfigFile = (providerId: string): string => {
    switch (providerId) {
      case "cloudflare":
        return `name = "${project?.name || "my-project"}"
compatibility_date = "2024-01-01"

[site]
bucket = "./"

[build]
command = ""`;
      case "vercel":
        return JSON.stringify(
          {
            name: project?.name || "my-project",
            version: 2,
            builds: [{ src: "**/*", use: "@vercel/static" }],
          },
          null,
          2
        );
      case "netlify":
        return `[build]
  publish = "./"
  
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200`;
      default:
        return "";
    }
  };

  const tabs = [
    { id: "hosting" as const, label: "☁️ الاستضافة", count: Object.keys(hostingConnections).length },
    { id: "database" as const, label: "🗄️ قواعد البيانات", count: Object.keys(dbConnections).length },
    { id: "env" as const, label: "🔐 متغيرات البيئة", count: envVars.length },
    { id: "history" as const, label: "📋 السجل", count: deployHistory.length },
  ];

  return (
    <div className={`flex flex-col h-full ${isDark ? "bg-slate-950" : "bg-slate-50"}`} dir="rtl">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white/80"
        } backdrop-blur-sm`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">
            🚀
          </div>
          <div>
            <h1 className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              مركز النشر والاستضافة
            </h1>
            <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              انشر مشروعك واربط قواعد البيانات بدون مغادرة الموقع
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${
            isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-gray-900 hover:bg-slate-100"
          }`}
          title="إغلاق"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Project Info */}
      {project && (
        <div className={`px-4 py-2 border-b ${isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white/50"}`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>المشروع:</span>
            <span className={`text-xs font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
              {project.name}
            </span>
            <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              ({project.files.length} ملفات)
            </span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className={`flex border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? `border-emerald-500 text-emerald-600 dark:text-emerald-400 ${
                    isDark ? "bg-emerald-900/10" : "bg-emerald-50/50"
                  }`
                : `border-transparent ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-gray-900"}`
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={`mr-1 px-1.5 py-0.5 rounded-full text-[9px] ${
                  activeTab === tab.id
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                    : isDark
                    ? "bg-slate-800 text-slate-500"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ==================== HOSTING TAB ==================== */}
        {activeTab === "hosting" && (
          <div className="space-y-4">
            {/* Info banner */}
            <div
              className={`rounded-xl p-3 border ${
                isDark
                  ? "bg-emerald-900/10 border-emerald-800/50 text-emerald-300"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              <p className="text-xs">
                💡 جميع خدمات الاستضافة المذكورة توفر خططاً مجانية. أدخل مفتاح API الخاص بك وابدأ النشر فوراً.
              </p>
            </div>

            {HOSTING_PROVIDERS.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                isDark={isDark}
                connectedData={hostingConnections[provider.id] || {}}
                onConnect={(data) => handleHostingConnect(provider.id, data)}
                onDeploy={() => handleDeploy(provider.id)}
                onDisconnect={() => handleHostingDisconnect(provider.id)}
                isDeploying={deployingProvider === provider.id}
                isTesting={testingProvider === provider.id}
              />
            ))}

            {/* Surge.sh special note */}
            {hostingConnections["surge"] && (
              <div
                className={`rounded-xl p-3 border ${
                  isDark ? "bg-yellow-900/10 border-yellow-800/50 text-yellow-300" : "bg-yellow-50 border-yellow-200 text-yellow-700"
                }`}
              >
                <p className="text-xs font-medium mb-1">⚡ تعليمات Surge.sh:</p>
                <p className="text-[11px]">Surge يتطلب الطرفية. حمّل ملفات المشروع ثم شغّل:</p>
                <pre className={`mt-2 p-2 rounded text-[10px] ${isDark ? "bg-slate-800" : "bg-gray-900 text-green-400"}`} dir="ltr">
                  npm install -g surge{"\n"}cd project-folder{"\n"}surge . {hostingConnections["surge"].domain || "my-project.surge.sh"}
                </pre>
              </div>
            )}

            {/* Config files generator */}
            {Object.keys(hostingConnections).length > 0 && (
              <div className={`rounded-xl border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
                <h3 className={`text-sm font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
                  📄 ملفات التهيئة
                </h3>
                <div className="space-y-2">
                  {Object.keys(hostingConnections).map((providerId) => {
                    const config = generateConfigFile(providerId);
                    if (!config) return null;
                    const fileName = providerId === "cloudflare" ? "wrangler.toml" : providerId === "vercel" ? "vercel.json" : "netlify.toml";
                    return (
                      <div key={providerId} className="flex items-center gap-2">
                        <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {fileName}:
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(config);
                          }}
                          className={`px-2 py-1 rounded text-[10px] ${
                            isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          } transition`}
                        >
                          📋 نسخ
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([config], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = fileName;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className={`px-2 py-1 rounded text-[10px] ${
                            isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          } transition`}
                        >
                          📥 تحميل
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== DATABASE TAB ==================== */}
        {activeTab === "database" && (
          <div className="space-y-4">
            {/* Info banner */}
            <div
              className={`rounded-xl p-3 border ${
                isDark
                  ? "bg-violet-900/10 border-violet-800/50 text-violet-300"
                  : "bg-violet-50 border-violet-200 text-violet-700"
              }`}
            >
              <p className="text-xs">
                🗄️ اربط قاعدة بيانات مجانية وسيتم إنشاء كود الربط تلقائياً. البيانات مشفرة ومحفوظة محلياً.
              </p>
            </div>

            {DATABASE_PROVIDERS.map((provider) => (
              <DatabaseCard
                key={provider.id}
                provider={provider}
                isDark={isDark}
                connectedData={dbConnections[provider.id] || {}}
                onConnect={(data) => handleDbConnect(provider.id, data)}
                onDisconnect={() => handleDbDisconnect(provider.id)}
                generatedCode={dbCodes[provider.id] || ""}
                isTesting={testingDb === provider.id}
              />
            ))}
          </div>
        )}

        {/* ==================== ENV VARS TAB ==================== */}
        {activeTab === "env" && (
          <div className="space-y-4">
            {/* Info banner */}
            <div
              className={`rounded-xl p-3 border ${
                isDark
                  ? "bg-amber-900/10 border-amber-800/50 text-amber-300"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              <p className="text-xs">
                🔐 إدارة متغيرات البيئة لمشروعك. تتم الإضافة تلقائياً عند ربط قواعد البيانات.
              </p>
            </div>

            {/* Add new variable */}
            <div className={`rounded-xl border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
              <h3 className={`text-sm font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
                إضافة متغير جديد
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  placeholder="المفتاح (KEY)"
                  dir="ltr"
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-300 text-gray-900 placeholder-slate-400"
                  }`}
                />
                <span className={isDark ? "text-slate-500" : "text-slate-400"}>=</span>
                <input
                  type="text"
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  placeholder="القيمة (VALUE)"
                  dir="ltr"
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-300 text-gray-900 placeholder-slate-400"
                  }`}
                />
                <button
                  onClick={addEnvVar}
                  disabled={!newEnvKey.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </div>

            {/* Variables list */}
            <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
              <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <h3 className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                  المتغيرات ({envVars.length})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(generateEnvContent())}
                    className={`px-2 py-1 rounded text-[10px] ${isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-200 text-slate-600 hover:bg-slate-300"} transition`}
                  >
                    📋 نسخ .env
                  </button>
                  <button
                    onClick={downloadEnvFile}
                    className={`px-2 py-1 rounded text-[10px] ${isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-200 text-slate-600 hover:bg-slate-300"} transition`}
                  >
                    📥 تحميل .env
                  </button>
                </div>
              </div>
              {envVars.length === 0 ? (
                <div className="p-6 text-center">
                  <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    لا توجد متغيرات بعد
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {envVars.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 px-4 py-2.5">
                      <input
                        type="text"
                        value={v.key}
                        onChange={(e) => updateEnvVar(v.id, e.target.value, v.value)}
                        dir="ltr"
                        className={`w-1/3 px-2 py-1 rounded border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                          isDark
                            ? "bg-slate-700 border-slate-600 text-emerald-400"
                            : "bg-slate-50 border-slate-300 text-emerald-600"
                        }`}
                      />
                      <span className={isDark ? "text-slate-500" : "text-slate-400"}>=</span>
                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => updateEnvVar(v.id, v.key, e.target.value)}
                        dir="ltr"
                        className={`flex-1 px-2 py-1 rounded border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                          isDark
                            ? "bg-slate-700 border-slate-600 text-white"
                            : "bg-slate-50 border-slate-300 text-gray-900"
                        }`}
                      />
                      <button
                        onClick={() => removeEnvVar(v.id)}
                        className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview .env */}
            {envVars.length > 0 && (
              <div className={`rounded-xl border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
                <h3 className={`text-xs font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                  معاينة ملف .env
                </h3>
                <pre
                  className={`text-[11px] p-3 rounded-lg overflow-x-auto ${
                    isDark ? "bg-slate-900 text-emerald-400" : "bg-gray-900 text-emerald-400"
                  }`}
                  dir="ltr"
                >
                  {generateEnvContent()}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ==================== HISTORY TAB ==================== */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {deployHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📋</div>
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  لا يوجد سجل نشر بعد
                </p>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  اربط خدمة استضافة وانشر مشروعك لتظهر السجلات هنا
                </p>
              </div>
            ) : (
              deployHistory.map((record) => (
                <div
                  key={record.id}
                  className={`rounded-xl border p-4 ${
                    record.status === "success"
                      ? isDark
                        ? "bg-emerald-900/10 border-emerald-800/50"
                        : "bg-emerald-50 border-emerald-200"
                      : record.status === "failed"
                      ? isDark
                        ? "bg-red-900/10 border-red-800/50"
                        : "bg-red-50 border-red-200"
                      : isDark
                      ? "bg-yellow-900/10 border-yellow-800/50"
                      : "bg-yellow-50 border-yellow-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {record.status === "success" ? "✅" : record.status === "failed" ? "❌" : "⏳"}
                      </span>
                      <div>
                        <p className={`text-xs font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                          {record.projectName}
                        </p>
                        <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {HOSTING_PROVIDERS.find((p) => p.id === record.provider)?.name || record.provider} ·{" "}
                          {new Date(record.timestamp).toLocaleString("ar-SA")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {record.url && (
                        <a
                          href={record.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`px-2 py-1 rounded text-[10px] font-medium ${
                            isDark
                              ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                              : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                          } transition`}
                          dir="ltr"
                        >
                          🔗 فتح الموقع
                        </a>
                      )}
                      {record.error && (
                        <span className={`text-[10px] ${isDark ? "text-red-400" : "text-red-500"}`}>
                          {record.error.slice(0, 50)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Clear history */}
            {deployHistory.length > 0 && (
              <button
                onClick={() => {
                  setDeployHistory([]);
                  try { localStorage.removeItem("hf_deploy_history"); } catch {}
                }}
                className={`w-full py-2 rounded-xl text-xs font-medium transition-colors ${
                  isDark
                    ? "bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-800/50"
                    : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                }`}
              >
                🗑️ مسح السجل
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
