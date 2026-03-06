## تطبيق تحدي التقديمات والانترفيوهات

تطبيق ويب كامل (Node + Express + Supabase) لإدارة تحدي تقديمات الوظائف والانترفيوهات، مع صفحة تسجيل، لوحة منافسة، ولوحة إدارة، مصمّم بالكامل بالعربي وواجهة RTL.

### طريقة التشغيل محليًا

1. ثبّت الحزم:

```bash
npm install
```

2. أنشئ ملف `.env` من `.env.example` وضع بيانات مشروع Supabase:

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
PORT=3000
```

3. تأكد من وجود جداول Supabase:

```sql
-- جدول submissions
create table submissions (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  email text,
  coach text,
  job text,
  type text not null,
  proof_type text not null,
  screenshot_urls text[],
  points integer default 0,
  created_at timestamp default now()
);

-- جدول competition_settings
create table competition_settings (
  id bigint generated always as identity primary key,
  start_date timestamp default now(),
  end_date timestamp not null,
  status text default 'running',
  created_at timestamp default now()
);

-- Enable security policies
alter table submissions enable row level security;
create policy "Allow all" on submissions for all using (true) with check (true);

alter table competition_settings enable row level security;
create policy "Allow all" on competition_settings for all using (true) with check (true);

-- Create Storage bucket 'screenshots' in Supabase Dashboard (Settings > Storage)
-- Make bucket PUBLIC for public URL access
```

4. أنشئ bucket باسم `screenshots` في Supabase Storage واجعله Public.

5. شغّل السيرفر:

```bash
npm start
```

ثم افتح المتصفح على:

- `http://localhost:3000/` صفحة التسجيل
- `http://localhost:3000/competition.html` لوحة المنافسة
- `http://localhost:3000/admin.html` لوحة الإدارة (كلمة السر: `Admin@2025`)
