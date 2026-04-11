// ============================================================
// HF Space Chat - Full-Stack Builder Templates
// قوالب المشاريع الجاهزة للبناء الفوري
// ============================================================

export interface BuilderFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
}

export interface BuilderProject {
  id: string;
  name: string;
  template: string;
  files: BuilderFile[];
  activeFileId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "frontend" | "fullstack" | "api" | "static";
  files: Omit<BuilderFile, "id">[];
}

let _fileIdCounter = 0;
export function generateFileId(): string {
  _fileIdCounter++;
  return `file-${Date.now()}-${_fileIdCounter}`;
}

export function generateProjectId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Determine language from file extension
export function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    html: "html", css: "css", json: "json", py: "python",
    md: "markdown", sql: "sql", sh: "bash", yml: "yaml",
    yaml: "yaml", env: "bash", gitignore: "bash",
    txt: "text", svg: "xml", xml: "xml",
  };
  return langMap[ext] || "text";
}

// ==================== TEMPLATES ====================

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "react-app",
    name: "React App",
    description: "تطبيق React مع Vite و Tailwind CSS",
    icon: "⚛️",
    category: "frontend",
    files: [
      {
        name: "index.html",
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="App.jsx"></script>
</body>
</html>`,
      },
      {
        name: "App.jsx",
        path: "App.jsx",
        language: "jsx",
        content: `const { useState, useEffect } = React;

function App() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [input, setInput] = useState("");

  const addItem = () => {
    if (input.trim()) {
      setItems([...items, { id: Date.now(), text: input, done: false }]);
      setInput("");
    }
  };

  const toggleItem = (id) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, done: !item.done } : item
    ));
  };

  const deleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-indigo-600">My React App</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Count: {count}</span>
            <button
              onClick={() => setCount(c => c + 1)}
              className="px-3 py-1 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 transition"
            >
              +
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Todo List</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="Add a new task..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={addItem}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
            >
              Add
            </button>
          </div>
          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-gray-400 text-center py-4">No tasks yet. Add one above!</p>
            )}
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 group">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleItem(item.id)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className={\`flex-1 \${item.done ? 'line-through text-gray-400' : 'text-gray-700'}\`}>
                  {item.text}
                </span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
      },
      {
        name: "styles.css",
        path: "styles.css",
        language: "css",
        content: `/* Custom styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}`,
      },
    ],
  },
  {
    id: "landing-page",
    name: "Landing Page",
    description: "صفحة هبوط احترافية مع Tailwind CSS",
    icon: "🚀",
    category: "static",
    files: [
      {
        name: "index.html",
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>صفحة هبوط</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="font-sans">
  <!-- Hero Section -->
  <header class="relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
    <nav class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold">S</div>
        <span class="text-lg font-bold">Startup</span>
      </div>
      <div class="hidden md:flex items-center gap-6 text-sm">
        <a href="#features" class="hover:text-purple-200 transition">المميزات</a>
        <a href="#pricing" class="hover:text-purple-200 transition">الأسعار</a>
        <a href="#contact" class="hover:text-purple-200 transition">تواصل معنا</a>
        <button class="px-4 py-2 bg-white text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition">ابدأ مجاناً</button>
      </div>
    </nav>
    <div class="max-w-6xl mx-auto px-6 py-20 text-center">
      <h1 class="text-4xl md:text-6xl font-bold mb-6 leading-tight">أنشئ تطبيقك<br/>القادم بسرعة</h1>
      <p class="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">منصة متكاملة تساعدك على بناء وتطوير ونشر تطبيقاتك بكل سهولة وسرعة فائقة</p>
      <div class="flex items-center justify-center gap-4">
        <button class="px-6 py-3 bg-white text-purple-700 rounded-xl font-bold hover:bg-purple-50 transition shadow-lg">ابدأ الآن مجاناً</button>
        <button class="px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition border border-white/20">شاهد العرض</button>
      </div>
    </div>
    <div class="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent"></div>
  </header>

  <!-- Features -->
  <section id="features" class="max-w-6xl mx-auto px-6 py-20">
    <h2 class="text-3xl font-bold text-center text-gray-900 mb-4">مميزات قوية</h2>
    <p class="text-gray-500 text-center mb-12 max-w-xl mx-auto">كل ما تحتاجه لبناء تطبيق احترافي في مكان واحد</p>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="p-6 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-lg transition">
        <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl mb-4">⚡</div>
        <h3 class="font-bold text-gray-900 mb-2">سرعة فائقة</h3>
        <p class="text-gray-500 text-sm leading-relaxed">أداء محسن وتحميل سريع لصفحاتك مع CDN عالمي وتقنيات ضغط متقدمة</p>
      </div>
      <div class="p-6 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-lg transition">
        <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl mb-4">🛡️</div>
        <h3 class="font-bold text-gray-900 mb-2">أمان متقدم</h3>
        <p class="text-gray-500 text-sm leading-relaxed">حماية شاملة لبياناتك مع تشفير SSL ونسخ احتياطي تلقائي يومياً</p>
      </div>
      <div class="p-6 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-lg transition">
        <div class="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-2xl mb-4">🎨</div>
        <h3 class="font-bold text-gray-900 mb-2">تصميم مرن</h3>
        <p class="text-gray-500 text-sm leading-relaxed">قوالب جاهزة قابلة للتخصيص بالكامل مع محرر سحب وإفلات بديهي</p>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section id="pricing" class="bg-gray-50 py-20">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-3xl font-bold text-center text-gray-900 mb-12">خطط الأسعار</h2>
      <div class="grid md:grid-cols-3 gap-8">
        <div class="bg-white rounded-2xl p-8 border border-gray-100">
          <h3 class="font-bold text-gray-900 mb-1">مجاني</h3>
          <p class="text-4xl font-bold text-gray-900 mb-6">$0<span class="text-sm text-gray-400 font-normal">/شهر</span></p>
          <ul class="space-y-3 text-sm text-gray-600 mb-8">
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> مشروع واحد</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 1GB مساحة</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> دعم مجتمعي</li>
          </ul>
          <button class="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">ابدأ مجاناً</button>
        </div>
        <div class="bg-white rounded-2xl p-8 border-2 border-purple-500 shadow-xl relative">
          <span class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-purple-500 text-white text-xs rounded-full">الأكثر شعبية</span>
          <h3 class="font-bold text-gray-900 mb-1">احترافي</h3>
          <p class="text-4xl font-bold text-gray-900 mb-6">$19<span class="text-sm text-gray-400 font-normal">/شهر</span></p>
          <ul class="space-y-3 text-sm text-gray-600 mb-8">
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> مشاريع غير محدودة</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 50GB مساحة</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> دعم فني 24/7</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> نطاق مخصص</li>
          </ul>
          <button class="w-full py-2.5 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition">اشترك الآن</button>
        </div>
        <div class="bg-white rounded-2xl p-8 border border-gray-100">
          <h3 class="font-bold text-gray-900 mb-1">المؤسسات</h3>
          <p class="text-4xl font-bold text-gray-900 mb-6">$99<span class="text-sm text-gray-400 font-normal">/شهر</span></p>
          <ul class="space-y-3 text-sm text-gray-600 mb-8">
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> كل شيء في الاحترافي</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> مساحة غير محدودة</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> SLA مضمون</li>
            <li class="flex items-center gap-2"><span class="text-green-500">✓</span> مدير حساب خاص</li>
          </ul>
          <button class="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">تواصل معنا</button>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer id="contact" class="bg-gray-900 text-gray-400 py-12">
    <div class="max-w-6xl mx-auto px-6 text-center">
      <div class="flex items-center justify-center gap-2 mb-4">
        <div class="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">S</div>
        <span class="text-white font-bold">Startup</span>
      </div>
      <p class="text-sm mb-6">أنشئ تطبيقك القادم بثقة وسرعة</p>
      <p class="text-xs text-gray-500">© 2025 Startup. جميع الحقوق محفوظة.</p>
    </div>
  </footer>
</body>
</html>`,
      },
      {
        name: "styles.css",
        path: "styles.css",
        language: "css",
        content: `/* Landing page custom styles */
html { scroll-behavior: smooth; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif; }

/* Smooth transitions */
* { transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms; }`,
      },
    ],
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "لوحة تحكم مع رسوم بيانية وإحصائيات",
    icon: "📊",
    category: "frontend",
    files: [
      {
        name: "index.html",
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="App.jsx"></script>
</body>
</html>`,
      },
      {
        name: "App.jsx",
        path: "App.jsx",
        language: "jsx",
        content: `const { useState } = React;

const stats = [
  { label: "Total Users", value: "24,521", change: "+12.5%", color: "blue" },
  { label: "Revenue", value: "$48,352", change: "+8.2%", color: "emerald" },
  { label: "Orders", value: "1,842", change: "+3.1%", color: "purple" },
  { label: "Conversion", value: "3.24%", change: "-0.4%", color: "orange" },
];

const recentOrders = [
  { id: "#3210", customer: "Ahmed Ali", product: "Pro Plan", amount: "$49.00", status: "Completed" },
  { id: "#3209", customer: "Sara Khan", product: "Basic Plan", amount: "$19.00", status: "Processing" },
  { id: "#3208", customer: "Mohammed Saeed", product: "Enterprise", amount: "$199.00", status: "Completed" },
  { id: "#3207", customer: "Fatima Nour", product: "Pro Plan", amount: "$49.00", status: "Pending" },
  { id: "#3206", customer: "Omar Hassan", product: "Basic Plan", amount: "$19.00", status: "Completed" },
];

const chartData = [40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function SimpleChart() {
  const maxVal = Math.max(...chartData);
  return (
    <div className="flex items-end gap-2 h-48 px-2">
      {chartData.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-md hover:from-blue-600 hover:to-blue-500 transition cursor-pointer relative group"
            style={{ height: \`\${(val / maxVal) * 100}%\` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              {val}K
            </div>
          </div>
          <span className="text-[10px] text-gray-400">{months[i]}</span>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={\`fixed md:relative z-40 w-64 bg-white border-r flex flex-col transition-transform \${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}\`}>
        <div className="p-4 border-b flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">D</div>
          <span className="font-bold text-gray-800">Dashboard</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {["Overview", "Analytics", "Users", "Orders", "Products", "Settings"].map(item => (
            <button key={item} className={\`w-full text-left px-3 py-2 rounded-lg text-sm transition \${
              item === "Overview" ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-600 hover:bg-gray-100"
            }\`}>{item}</button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Overview</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">A</div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border p-5">
                <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <span className={\`text-xs font-medium px-2 py-0.5 rounded-full \${
                    stat.change.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }\`}>{stat.change}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Revenue Overview</h3>
            <SimpleChart />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-900">Recent Orders</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Order</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Customer</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Product</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Amount</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{order.id}</td>
                      <td className="px-5 py-3 text-gray-600">{order.customer}</td>
                      <td className="px-5 py-3 text-gray-600">{order.product}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{order.amount}</td>
                      <td className="px-5 py-3">
                        <span className={\`px-2 py-0.5 rounded-full text-xs font-medium \${
                          order.status === 'Completed' ? 'bg-green-50 text-green-600' :
                          order.status === 'Processing' ? 'bg-blue-50 text-blue-600' :
                          'bg-yellow-50 text-yellow-600'
                        }\`}>{order.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
      },
      {
        name: "styles.css",
        path: "styles.css",
        language: "css",
        content: `/* Dashboard custom styles */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }`,
      },
    ],
  },
  {
    id: "express-api",
    name: "Express API",
    description: "خادم REST API مع Node.js و Express",
    icon: "🔧",
    category: "api",
    files: [
      {
        name: "server.js",
        path: "server.js",
        language: "javascript",
        content: `const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory data store
let items = [
  { id: '1', name: 'Item One', description: 'First item', status: 'active', createdAt: new Date().toISOString() },
  { id: '2', name: 'Item Two', description: 'Second item', status: 'active', createdAt: new Date().toISOString() },
  { id: '3', name: 'Item Three', description: 'Third item', status: 'inactive', createdAt: new Date().toISOString() },
];

// Routes
// GET all items
app.get('/api/items', (req, res) => {
  const { status, search } = req.query;
  let filtered = items;
  if (status) filtered = filtered.filter(i => i.status === status);
  if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  res.json({ success: true, data: filtered, count: filtered.length });
});

// GET single item
app.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
  res.json({ success: true, data: item });
});

// POST create item
app.post('/api/items', (req, res) => {
  const { name, description, status } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
  const newItem = {
    id: uuidv4(),
    name,
    description: description || '',
    status: status || 'active',
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);
  res.status(201).json({ success: true, data: newItem });
});

// PUT update item
app.put('/api/items/:id', (req, res) => {
  const index = items.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Item not found' });
  items[index] = { ...items[index], ...req.body, id: items[index].id };
  res.json({ success: true, data: items[index] });
});

// DELETE item
app.delete('/api/items/:id', (req, res) => {
  const index = items.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Item not found' });
  items.splice(index, 1);
  res.json({ success: true, message: 'Item deleted' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
      },
      {
        name: "package.json",
        path: "package.json",
        language: "json",
        content: `{
  "name": "express-api",
  "version": "1.0.0",
  "description": "REST API with Express.js",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}`,
      },
      {
        name: ".env.example",
        path: ".env.example",
        language: "bash",
        content: `PORT=3000
NODE_ENV=development`,
      },
      {
        name: "README.md",
        path: "README.md",
        language: "markdown",
        content: `# Express REST API

## Setup
\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

## API Endpoints
- GET /api/health - Health check
- GET /api/items - List all items
- GET /api/items/:id - Get single item
- POST /api/items - Create item
- PUT /api/items/:id - Update item
- DELETE /api/items/:id - Delete item

## Query Parameters
- \`?status=active\` - Filter by status
- \`?search=keyword\` - Search by name`,
      },
    ],
  },
  {
    id: "python-api",
    name: "Python API",
    description: "خادم REST API مع Python و Flask",
    icon: "🐍",
    category: "api",
    files: [
      {
        name: "app.py",
        path: "app.py",
        language: "python",
        content: `from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app)

# In-memory data store
items = [
    {"id": "1", "name": "Item One", "description": "First item", "status": "active", "createdAt": datetime.now().isoformat()},
    {"id": "2", "name": "Item Two", "description": "Second item", "status": "active", "createdAt": datetime.now().isoformat()},
]

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})

@app.route('/api/items', methods=['GET'])
def get_items():
    status = request.args.get('status')
    search = request.args.get('search')
    filtered = items
    if status:
        filtered = [i for i in filtered if i['status'] == status]
    if search:
        filtered = [i for i in filtered if search.lower() in i['name'].lower()]
    return jsonify({"success": True, "data": filtered, "count": len(filtered)})

@app.route('/api/items/<item_id>', methods=['GET'])
def get_item(item_id):
    item = next((i for i in items if i['id'] == item_id), None)
    if not item:
        return jsonify({"success": False, "error": "Item not found"}), 404
    return jsonify({"success": True, "data": item})

@app.route('/api/items', methods=['POST'])
def create_item():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({"success": False, "error": "Name is required"}), 400
    new_item = {
        "id": str(uuid.uuid4()),
        "name": data['name'],
        "description": data.get('description', ''),
        "status": data.get('status', 'active'),
        "createdAt": datetime.now().isoformat(),
    }
    items.append(new_item)
    return jsonify({"success": True, "data": new_item}), 201

@app.route('/api/items/<item_id>', methods=['PUT'])
def update_item(item_id):
    index = next((i for i, item in enumerate(items) if item['id'] == item_id), None)
    if index is None:
        return jsonify({"success": False, "error": "Item not found"}), 404
    data = request.get_json()
    items[index].update({k: v for k, v in data.items() if k != 'id'})
    return jsonify({"success": True, "data": items[index]})

@app.route('/api/items/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    index = next((i for i, item in enumerate(items) if item['id'] == item_id), None)
    if index is None:
        return jsonify({"success": False, "error": "Item not found"}), 404
    items.pop(index)
    return jsonify({"success": True, "message": "Item deleted"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)`,
      },
      {
        name: "requirements.txt",
        path: "requirements.txt",
        language: "text",
        content: `flask==3.0.0
flask-cors==4.0.0`,
      },
    ],
  },
  {
    id: "fullstack-app",
    name: "Full-Stack App",
    description: "تطبيق كامل React + Node.js API",
    icon: "🏗️",
    category: "fullstack",
    files: [
      {
        name: "index.html",
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Full-Stack App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="App.jsx"></script>
</body>
</html>`,
      },
      {
        name: "App.jsx",
        path: "App.jsx",
        language: "jsx",
        content: `const { useState, useEffect } = React;

// Simple CRUD app with local state (simulates API calls)
function App() {
  const [users, setUsers] = useState([
    { id: 1, name: "Ahmed Ali", email: "ahmed@example.com", role: "Admin" },
    { id: 2, name: "Sara Khan", email: "sara@example.com", role: "Editor" },
    { id: 3, name: "Omar Saeed", email: "omar@example.com", role: "Viewer" },
  ]);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'Viewer' });
  const [editingId, setEditingId] = useState(null);
  const [activePage, setActivePage] = useState('users');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      setUsers(users.map(u => u.id === editingId ? { ...formData, id: editingId } : u));
      setEditingId(null);
    } else {
      setUsers([...users, { ...formData, id: Date.now() }]);
    }
    setFormData({ name: '', email: '', role: 'Viewer' });
  };

  const editUser = (user) => {
    setFormData({ name: user.name, email: user.email, role: user.role });
    setEditingId(user.id);
  };

  const deleteUser = (id) => {
    setUsers(users.filter(u => u.id !== id));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">F</div>
          <span className="font-bold text-gray-800">FullStack</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[{id:'users',icon:'👥',label:'Users'},{id:'settings',icon:'⚙️',label:'Settings'},{id:'api',icon:'🔌',label:'API Docs'}].map(item => (
            <button key={item.id} onClick={() => setActivePage(item.id)}
              className={\`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition \${
                activePage === item.id ? 'bg-violet-50 text-violet-600 font-medium' : 'text-gray-600 hover:bg-gray-100'
              }\`}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t">
          <div className="px-3 py-2 bg-violet-50 rounded-lg text-xs text-violet-600">
            <p className="font-medium">API Status</p>
            <p className="text-violet-400 mt-0.5">● Connected</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your application users and permissions</p>
        </header>

        <div className="p-6 space-y-6">
          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold mb-4">{editingId ? 'Edit User' : 'Add New User'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="text" placeholder="Name" required value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <input type="email" placeholder="Email" required value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <div className="flex gap-2">
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option>Viewer</option><option>Editor</option><option>Admin</option>
                </select>
                <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 transition">
                  {editingId ? 'Update' : 'Add'}
                </button>
                {editingId && (
                  <button type="button" onClick={() => { setEditingId(null); setFormData({name:'',email:'',role:'Viewer'}); }}
                    className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
                )}
              </div>
            </div>
          </form>

          {/* Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Role</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{user.name}</td>
                    <td className="px-5 py-3 text-gray-600">{user.email}</td>
                    <td className="px-5 py-3">
                      <span className={\`px-2 py-0.5 rounded-full text-xs font-medium \${
                        user.role === 'Admin' ? 'bg-violet-50 text-violet-600' :
                        user.role === 'Editor' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
                      }\`}>{user.role}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => editUser(user)} className="text-violet-600 hover:text-violet-800 text-xs font-medium">Edit</button>
                        <button onClick={() => deleteUser(user.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
      },
      {
        name: "server.js",
        path: "server.js",
        language: "javascript",
        content: `const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Sample API routes
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/api/users', (req, res) => {
  res.status(201).json({ user: req.body });
});

app.listen(3001, () => console.log('API server on port 3001'));`,
      },
      {
        name: "styles.css",
        path: "styles.css",
        language: "css",
        content: `/* Full-Stack App styles */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }`,
      },
      {
        name: "package.json",
        path: "package.json",
        language: "json",
        content: `{
  "name": "fullstack-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently \\"nodemon server.js\\" \\"live-server --port=3000\\"",
    "server": "nodemon server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "concurrently": "^8.0.0",
    "nodemon": "^3.0.0"
  }
}`,
      },
    ],
  },
  {
    id: "blank",
    name: "مشروع فارغ",
    description: "ابدأ من الصفر مع ملف HTML فارغ",
    icon: "📄",
    category: "static",
    files: [
      {
        name: "index.html",
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>مشروعي</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="min-h-screen bg-gray-50 flex items-center justify-center">
  <div class="text-center">
    <h1 class="text-4xl font-bold text-gray-900 mb-4">مرحباً بالعالم! 🌍</h1>
    <p class="text-gray-500 mb-6">ابدأ بتعديل هذا الملف لبناء مشروعك</p>
    <button class="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg">
      ابدأ الآن
    </button>
  </div>
</body>
</html>`,
      },
      {
        name: "styles.css",
        path: "styles.css",
        language: "css",
        content: `/* Custom styles - أضف أنماطك هنا */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif;
}`,
      },
    ],
  },
];

// ==================== AI SYSTEM PROMPT ====================

export const CODE_GEN_SYSTEM_PROMPT = `You are an expert full-stack developer AI assistant. Your task is to generate complete, working code based on the user's description.

IMPORTANT RULES:
1. Generate COMPLETE, WORKING code - no placeholders or TODOs
2. Use modern best practices and clean code
3. For web projects: use Tailwind CSS via CDN for styling
4. For React projects: use React 18 with CDN (react, react-dom, babel)
5. Wrap each file's content in clear markers like this:

===FILE: filename.ext===
(file content here)
===ENDFILE===

6. Always include an index.html as the entry point for frontend projects
7. Make the UI responsive and visually appealing
8. Include proper error handling
9. Use Arabic comments when the user writes in Arabic
10. Generate at least 2-3 files per project (HTML + CSS + JS/JSX)

Example output format:
===FILE: index.html===
<!DOCTYPE html>...
===ENDFILE===

===FILE: styles.css===
body { ... }
===ENDFILE===

===FILE: App.jsx===
const App = () => { ... }
===ENDFILE===`;

// Parse AI response into files
export function parseAIResponseToFiles(response: string): Omit<BuilderFile, "id">[] {
  const files: Omit<BuilderFile, "id">[] = [];
  const fileRegex = /===FILE:\s*(.+?)===\n([\s\S]*?)===ENDFILE===/g;
  let match;

  while ((match = fileRegex.exec(response)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    files.push({
      name: filename,
      path: filename,
      content,
      language: getLanguage(filename),
    });
  }

  // Fallback: if no file markers found, try to extract code blocks
  if (files.length === 0) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let blockMatch;
    let blockIndex = 0;

    while ((blockMatch = codeBlockRegex.exec(response)) !== null) {
      const lang = blockMatch[1] || "text";
      const content = blockMatch[2].trim();
      let filename: string;

      // Try to guess filename from content
      if (content.includes("<!DOCTYPE html>") || content.includes("<html")) {
        filename = "index.html";
      } else if (content.includes("function App") || content.includes("const App")) {
        filename = "App.jsx";
      } else if (lang === "css" || content.includes("{") && content.includes(":") && content.includes(";")) {
        filename = "styles.css";
      } else if (lang === "javascript" || lang === "js") {
        filename = `script${blockIndex > 0 ? blockIndex : ""}.js`;
      } else if (lang === "python" || lang === "py") {
        filename = "app.py";
      } else if (lang === "json") {
        filename = "package.json";
      } else {
        filename = `file${blockIndex || ""}.${lang === 'typescript' ? 'ts' : lang === 'jsx' ? 'jsx' : 'txt'}`;
      }

      // Avoid duplicate filenames
      if (!files.some(f => f.name === filename)) {
        files.push({ name: filename, path: filename, content, language: lang });
      }
      blockIndex++;
    }
  }

  // If still no files, wrap the entire response as an HTML file
  if (files.length === 0) {
    files.push({
      name: "index.html",
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Generated Project</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50 p-8">
  <div class="max-w-4xl mx-auto">
    <div class="bg-white rounded-xl shadow-sm border p-6">
      <pre class="whitespace-pre-wrap text-sm text-gray-700">${response.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </div>
  </div>
</body>
</html>`,
      language: "html",
    });
  }

  return files;
}

// Assemble files into a single HTML document for preview
export function assemblePreviewHTML(files: BuilderFile[]): string {
  // Find the HTML file
  const htmlFile = files.find(f => f.name.endsWith(".html"));
  if (!htmlFile) {
    // If no HTML file, create a basic one
    const cssFiles = files.filter(f => f.name.endsWith(".css"));
    const jsFiles = files.filter(f => f.name.endsWith(".js") || f.name.endsWith(".jsx"));

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  ${cssFiles.map(f => `<style>${f.content}</style>`).join("\n")}
</head>
<body>
  <div id="root"></div>
  ${jsFiles.map(f => f.name.endsWith(".jsx") ?
    `<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
     <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
     <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
     <script type="text/babel">${f.content}</script>` :
    `<script>${f.content}</script>`
  ).join("\n")}
</body>
</html>`;
  }

  // If there's an HTML file, inject CSS and JS from other files
  let html = htmlFile.content;

  // Inject CSS files that aren't already linked
  const cssFiles = files.filter(f => f.name.endsWith(".css") && f.name !== "index.html");
  for (const cssFile of cssFiles) {
    const linkTag = `<link rel="stylesheet" href="${cssFile.name}" />`;
    if (!html.includes(linkTag) && !html.includes(cssFile.name)) {
      // Replace the link with inline style
      html = html.replace(
        linkTag,
        `<style>/* ${cssFile.name} */\n${cssFile.content}</style>`
      );
    } else if (!html.includes(cssFile.name)) {
      html = html.replace(
        "</head>",
        `<style>/* ${cssFile.name} */\n${cssFile.content}</style>\n</head>`
      );
    } else {
      // Link tag exists, replace with inline style
      html = html.replace(
        linkTag,
        `<style>/* ${cssFile.name} */\n${cssFile.content}</style>`
      );
    }
  }

  // Inject JSX files that aren't already referenced
  const jsxFiles = files.filter(f => f.name.endsWith(".jsx"));
  for (const jsxFile of jsxFiles) {
    const scriptTag = `<script type="text/babel" src="${jsxFile.name}"></script>`;
    if (html.includes(scriptTag)) {
      html = html.replace(
        scriptTag,
        `<script type="text/babel">\n${jsxFile.content}\n</script>`
      );
    }
  }

  // Inject JS files
  const jsFiles = files.filter(f => f.name.endsWith(".js") && !f.name.endsWith(".jsx"));
  for (const jsFile of jsFiles) {
    const scriptTag = `<script src="${jsFile.name}"></script>`;
    if (html.includes(scriptTag)) {
      html = html.replace(
        scriptTag,
        `<script>\n${jsFile.content}\n</script>`
      );
    }
  }

  return html;
}
