# ক্লাস প্ল্যানার — Vercel দিয়ে ডিপ্লয় গাইড

Shared quiz/assignment/presentation/task tracker with real browser push notifications
(works even when the browser is closed, as long as the reminder job has run recently).

## এটা কী দিয়ে বানানো
- **Next.js** — website (frontend + API routes)
- **Upstash Redis** (free) — ডেটা স্টোরেজ, সবার জন্য shared
- **Web Push (VAPID)** — ব্রাউজার পুশ নোটিফিকেশন
- **Vercel** — hosting + cron job রিমাইন্ডার পাঠানোর জন্য

---

## ধাপ ১: Upstash Redis বানাও (ফ্রি)
1. https://console.upstash.com — এখানে ফ্রি অ্যাকাউন্ট বানাও (GitHub দিয়ে লগইন করা যায়)।
2. **Create Database** চাপো, একটা Redis database বানাও (Region যেকোনো, Global/Regional দুটোই চলবে)।
3. Database-এর ভেতরে **REST API** সেকশন থেকে দুটো জিনিস কপি করো:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

(Vercel-এর Storage মার্কেটপ্লেস থেকেও Upstash যোগ করা যায়, যেটা এই দুটো env var অটোমেটিক সেট করে দেয় — চাইলে সেভাবেও করতে পারো।)

## ধাপ ২: VAPID কী (পুশ নোটিফিকেশনের জন্য)
**নিজের কী-পেয়ার বানাও** — লোকালি এই কমান্ড চালিয়ে:
```
npx web-push generate-vapid-keys
```
এটা দুটো ভ্যালু দেবে — `Public Key` আর `Private Key`। দুটোই কপি করে সরাসরি Vercel-এর Environment Variables-এ বসাও
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY` আর `VAPID_PRIVATE_KEY`), **কখনো এই README বা কোনো কোড ফাইলে আসল
key value বসিও না** — বিশেষ করে repo public হলে সেটা সবাই দেখে ফেলবে।

## ধাপ ৩: GitHub-এ কোড push করো
```
cd class-planner
git init
git add .
git commit -m "class planner"
git branch -M main
git remote add origin https://github.com/<তোমার-username>/class-planner.git
git push -u origin main
```

## ধাপ ৪: Vercel-এ ডিপ্লয় করো
1. https://vercel.com — GitHub দিয়ে লগইন করো।
2. **Add New → Project** → তোমার GitHub রিপো সিলেক্ট করো → **Import**।
3. Deploy করার আগে **Environment Variables** সেকশনে এগুলো যোগ করো:

| Key | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | (ধাপ ১ থেকে) |
| `UPSTASH_REDIS_REST_TOKEN` | (ধাপ ১ থেকে) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | (ধাপ ২ থেকে) |
| `VAPID_PRIVATE_KEY` | (ধাপ ২ থেকে) |
| `CRON_SECRET` | নিজের একটা র‍্যান্ডম পাসওয়ার্ড বসাও |
| `SITE_USER` | সাইটে ঢুকতে যেই username দিয়ে লগইন করবে |
| `SITE_PASSWORD` | সাইটে ঢুকতে যেই পাসওয়ার্ড দিয়ে লগইন করবে (তুমি আর তোমার বন্ধু ছাড়া কেউ জানবে না) |

**নোট:** `SITE_USER` / `SITE_PASSWORD` সেট করলে পুরো সাইট (browser-এর নিজস্ব) login popup দিয়ে লক হয়ে যাবে —
তুমি আর তোমার বন্ধু ছাড়া কেউ সাইট খুলতে পারবে না। প্রতিটা ডিভাইসে (ফোন/ল্যাপটপ) প্রথমবার ঢোকার সময় একবার
username/password চাইবে, তারপর browser সেটা মনে রাখবে — বারবার দিতে হবে না। এটা সবার জন্য shared একটাই
username/password, আলাদা আলাদা account না।

4. **Deploy** চাপো। ২-৩ মিনিটে সাইট লাইভ হয়ে যাবে — একটা `.vercel.app` লিংক পাবে, সেটা সবাইকে শেয়ার করো।

---

## রিমাইন্ডার কতবার চেক হবে? (জরুরি অংশ)

`vercel.json`-এ একটা **daily** cron job সেট করা আছে (`/api/send-reminders`), কারণ Vercel-এর ফ্রি (Hobby) প্ল্যানে
নিজস্ব cron দিনে একবারের বেশি চালানো যায় না। এতে শুধু দিনে একবার ডেডলাইন চেক হবে, যা যথেষ্ট রিয়েল-টাইম না।

**বেশি ঘন ঘন (যেমন প্রতি ১৫-৩০ মিনিটে) চেক করাতে চাইলে** একটা ফ্রি external scheduler ব্যবহার করো:

1. https://cron-job.org — ফ্রি অ্যাকাউন্ট বানাও।
2. নতুন cron job বানাও, এই URL-এ প্রতি ১৫ মিনিটে একটা request পাঠাতে বলো:
   ```
   https://<তোমার-সাইট>.vercel.app/api/send-reminders?secret=<CRON_SECRET>
   ```
   (`<CRON_SECRET>` ওপরে Vercel-এ যেটা সেট করেছ, সেটাই বসাও)
3. এতে প্রতি ১৫ মিনিটে সিস্টেম চেক করবে কার ডেডলাইন ২৪ ঘণ্টা বা ১ ঘণ্টার মধ্যে আছে, আর সেই অনুযায়ী পুশ নোটিফিকেশন পাঠাবে (একবারই, দুইবার পাঠাবে না)।

---

## কীভাবে ব্যবহার করবে
- সাইটে ঢুকে **"+ নতুন যোগ করো"** দিয়ে quiz/assignment/presentation/task যোগ করো — এটা সবাই দেখতে পাবে (shared)।
- **"🔔 রিমাইন্ডার অফ"** বাটনে চাপলে ব্রাউজার notification permission চাইবে। Allow করলে তুমি ঐ ডিভাইসে পুশ নোটিফিকেশন পাবে, ব্রাউজার/ট্যাব বন্ধ থাকলেও — যতক্ষণ ফোন/কম্পিউটার ইন্টারনেটে কানেক্টেড থাকে।
- প্রত্যেক classmate যার যার ডিভাইসে আলাদাভাবে "রিমাইন্ডার অন" করতে হবে — এটা per-device সেটিং।

## লোকাল ডেভেলপমেন্ট (অপশনাল)
```
npm install
cp .env.example .env.local   # তারপর .env.local-এ ভ্যালুগুলো বসাও
npm run dev
```
`http://localhost:3000` এ ওপেন হবে। (নোট: পুশ নোটিফিকেশন লোকালহোস্টেও কাজ করে, কিন্তু deploy করা HTTPS সাইটেই সবচেয়ে নির্ভরযোগ্য।)
