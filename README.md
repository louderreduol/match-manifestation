# Manifestation Match — GitHub Pages Embed

This folder is ready to push to a **public GitHub repo** and host on **GitHub Pages**.
It loads your `casita-file.glb`, lets visitors click/tap to light a flame, and updates a **global counter** via Supabase.

## Quick start
1. Create a new public repo named `match-manifestation`.
2. Upload these files to the repo root.
3. Enable GitHub Pages (Settings → Pages → Source: `main` branch / root).
4. Create a Supabase project and fill the credentials in `index.html` (see below).
5. Visit your Pages URL and embed it in Adobe Portfolio with an `<iframe>`.

## Supabase (global counter)
Run this SQL in Supabase (SQL Editor):

```sql
create table if not exists counters (
  id int primary key,
  count bigint not null default 0
);

insert into counters (id, count)
values (1, 0)
on conflict (id) do nothing;

create or replace function get_manifestation()
returns bigint
language sql
as $$
  select count from counters where id = 1;
$$;

create or replace function increment_manifestation()
returns bigint
language sql
security definer
as $$
  update counters set count = count + 1 where id = 1 returning count;
$$;

alter function increment_manifestation() owner to postgres;
```

**RLS (Row Level Security):**
- Leave RLS **enabled** on `counters`.
- Create policy to allow **select** to anon:
  - Table Editor → Policies → New Policy → `Enable read to anon` with `using: true`.
- No update/insert/delete policies needed because we use the **RPC** to increment.

**Keys:**
- Copy your **Project URL** and **anon public key** from Supabase → Project Settings → API.
- Open `index.html` and replace:
  - `REPLACE_WITH_YOUR_SUPABASE_URL`
  - `REPLACE_WITH_YOUR_SUPABASE_ANON_KEY`

## Embed in Adobe Portfolio
Use an Embed block:
```html
<iframe src="https://YOUR_USERNAME.github.io/match-manifestation/" width="100%" height="700" style="border:none;"></iframe>
```

## Tune the visuals
- Flame size: edit `flame.scale.set(0.06, 0.12, 1)` in `main.js`.
- Light radius: `new THREE.PointLight(0xffc46b, 1.3, 0.25, 2)` → tweak intensity/distance.
- Cooldown: `window.CLICK_COOLDOWN_MS` in `index.html`.