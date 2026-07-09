# Tom & Jerry ვიდეო საიტი (უფასო ვერსია — Cloudflare R2 + Render)

მარტივი ვიდეო-გაზიარების საიტი:
- **საჯარო გვერდი** (`/`) — ყველას შეუძლია ვიდეოების ძებნა და ყურება, პაროლის გარეშე, ნებისმიერი მოწყობილობიდან.
- **ადმინ გვერდი** (`/admin`) — მხოლოდ შენთვის, პაროლით `777`: ვიდეოს ატვირთვა, სახელის შეცვლა, წაშლა.
- ვიდეოები და თამბნეილები ინახება **Cloudflare R2**-ში (10GB უფასოდ, სამუდამოდ, ჩამოტვირთვაზე ნულოვანი საკომისიოთი).
- თავად საიტი გაშვებულია **Render**-ის უფასო web service-ზე.

---

## ⚠️ პირველი ნაბიჯი — ლოგო და ფონი

საავტორო უფლებების გამო ვერ ჩავსვამდი Tom & Jerry-ის ორიგინალურ სურათებს კოდში. ჩავდე დროებითი (placeholder) სურათები — **შენ თვითონ** ჩაანაცვლე ეს ორი ფაილი შენი საკუთარი სურათებით (იგივე ფაილის სახელებით):

```
public/assets/logo.png         ← ტომისა და ჯერის თავები (500x500-ის ირგვლივ)
public/assets/background.jpg   ← ლურჯ ფონზე ტომი და ჯერი (1600x900+ )
```

---

## ნაწილი 1 — Cloudflare R2-ის გამართვა (უფასო საცავი)

1. **დარეგისტრირდი** [cloudflare.com](https://dash.cloudflare.com/sign-up)-ზე (საკრედიტო ბარათი არ სჭირდება R2-სთვის).

2. მარცხენა მენიუში გადადი **R2 Object Storage** → **Create bucket**.
   - სახელი: მაგ. `tomjerry-videos` (დაიმახსოვრე, დაგჭირდება).
   - Location: Automatic.

3. **ჩართე საჯარო წვდომა** (რომ ვიდეოები ბრაუზერში ჩანდეს):
   - შექმნილ bucket-ში → **Settings** → **Public Access** → **R2.dev subdomain** → **Allow Access**.
   - მიიღებ ბმულს, მაგ.: `https://pub-xxxxxxxxxxxxxxxx.r2.dev` — ეს არის შენი `R2_PUBLIC_URL`.

4. **შექმენი API ტოკენი**:
   - R2 გვერდზე → **Manage R2 API Tokens** → **Create API Token**.
   - Permissions: **Object Read & Write**.
   - Apply to specific bucket: აირჩიე `tomjerry-videos`.
   - შექმენი — გამოგიჩნდება:
     - `Access Key ID`
     - `Secret Access Key`
     - `Account ID` (ჩანს ტოკენის დეტალებში ან R2-ის მთავარ გვერდზე, ან account-ის URL-ში)

შეინახე სამივე მნიშვნელობა — შემდეგ ეტაპზე დაგჭირდება.

---

## ნაწილი 2 — კოდის ატვირთვა GitHub-ზე

შექმენი ახალი repository და ატვირთე მთელი ეს საქაღალდე (`git init`, `git add .`, `git commit`, `git push`), ან პირდაპირ GitHub-ის ვებ ინტერფეისით.

---

## ნაწილი 3 — Render-ზე დეპლოი (უფასო)

1. [render.com](https://render.com)-ზე რეგისტრაცია (GitHub ანგარიშით).

2. **New** → **Web Service** → დაუკავშირდი შენს repo-ს.

3. პარამეტრები:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**

4. **Environment Variables** (Settings → Environment):
   ```
   ADMIN_PASSWORD=777
   SESSION_SECRET=ნებისმიერი-გრძელი-შემთხვევითი-სტრიქონი
   R2_ACCOUNT_ID=<შენი Account ID>
   R2_ACCESS_KEY_ID=<შენი Access Key ID>
   R2_SECRET_ACCESS_KEY=<შენი Secret Access Key>
   R2_BUCKET_NAME=tomjerry-videos
   R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
   ```

5. **Create Web Service** — Render ააგებს და გაუშვებს. რამდენიმე წუთში მიიღებ საჯარო ბმულს, მაგ. `https://your-app.onrender.com`.

---

## რას ნიშნავს "უფასო" ამ სქემაში

| ნაწილი | ფასი |
|---|---|
| Render Free web service | $0 — მაგრამ 15 წუთის უქმობის შემდეგ "იძინებს", პირველი შესვლა ~30-60 წმ-ით ნელია |
| Cloudflare R2 | $0 — 10GB საცავი, ულიმიტო ჩამოტვირთვა (ეს საკმარისია ~15-20 საშუალო ზომის ვიდეოსთვის) |

პირადი/მცირე გამოყენებისთვის (ოჯახი, მეგობრები) ეს სქემა სრულად უფასოა შეუზღუდავად. თუ 10GB-ს გადააჭარბებ ან გინდა Render არასდროს "იძინებდეს", მაშინ საჭირო გახდება მცირე გადახდა (Render Starter $7/თვე, ან R2-ზე დამატებითი GB — $0.015/GB/თვე).

---

## ლოკალურად ტესტირება

```bash
npm install
```

შექმენი `.env` ფაილი (ან დააყენე environment variables სხვაგვარად):
```
ADMIN_PASSWORD=777
SESSION_SECRET=local-dev-secret
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=tomjerry-videos
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

გაუშვი:
```bash
npm start
```

`http://localhost:3000` — საჯარო გვერდი
`http://localhost:3000/admin` — ადმინ პანელი (პაროლი: `777`)

---

## ფაილების სტრუქტურა

```
server.js              ← backend სერვერი (Express + Cloudflare R2)
package.json
public/
  index.html            ← საჯარო გვერდი
  admin.html            ← ადმინ გვერდი
  css/style.css
  js/main.js
  js/admin.js
  assets/
    logo.png              ← შენი ლოგო (ჩაანაცვლე!)
    background.jpg        ← შენი ფონი (ჩაანაცვლე!)
```

ვიდეოები, თამბნეილები და მონაცემები (`data/videos.json`) ინახება Cloudflare R2-ში, არა ლოკალურ დისკზე — ამიტომ Render-ის free tier-ის "ძილიც" და ხელახალი დეპლოიც აღარაფერს შლის.

## შენიშვნა უსაფრთხოებაზე

პაროლი `777` ძალიან მარტივია. თუ საიტი საჯაროდ ხელმისაწვდომი იქნება ბევრი ადამიანისთვის, გირჩევ `ADMIN_PASSWORD`-ში უფრო რთული პაროლის დაყენებას.
