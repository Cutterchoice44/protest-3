// script_IND_DJ.js
const API_KEY      = "pk_0b8abc6f834b444f949f727e88a728e0";
const BASE_URL     = "https://api.radiocult.fm/api";
const STATION_ID   = "cutters-choice-radio";
const MIXCLOUD_PW  = "cutters44";
const FALLBACK_ART = "https://i.imgur.com/qWOfxOS.png";

// Replace only the profile-wrapper on errors
function showNotFound() {
  const w = document.querySelector('.profile-wrapper');
  if (w) w.innerHTML = `<p style="color:white;text-align:center;margin:2rem;">
    Profile not found.
  </p>`;
}
function showError() {
  const w = document.querySelector('.profile-wrapper');
  if (w) w.innerHTML = `<p style="color:white;text-align:center;margin:2rem;">
    Error loading profile.
  </p>`;
}

// Build a Google Calendar link
function createGoogleCalLink(title, startUtc, endUtc) {
  if (!startUtc || !endUtc) return "#";
  const fmt = dt => new Date(dt)
    .toISOString()
    .replace(/-|:|\.\d{3}/g, '');
  return `https://www.google.com/calendar/render?action=TEMPLATE` +
         `&text=${encodeURIComponent(title)}` +
         `&dates=${fmt(startUtc)}/${fmt(endUtc)}`;
}

async function initPage() {
  console.clear();
  console.log("▶️ script_IND_DJ.js init");
  const params   = new URLSearchParams(window.location.search);
  const artistId = params.get("id");
  if (!artistId) {
    console.warn("No ?id= in URL");
    return showNotFound();
  }

  try {
    // 1) Fetch the artist detail
    const res = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}`,
      { headers: { "x-api-key": API_KEY } }
    );
    if (!res.ok) {
      if (res.status === 404) return showNotFound();
      throw new Error(`Artist API ${res.status}`);
    }
    const payload = await res.json();

    // 2) Unwrap whichever wrapper your API uses
    const artist =
      payload.artist ||
      (payload.data && payload.data.artist) ||
      payload.data ||
      payload;

    console.log("🏷️ artist record:", artist);

    // 3) Only show DJs tagged "website"
    const tags = Array.isArray(artist.tags)
      ? artist.tags.map(t => String(t).toLowerCase())
      : [];
    if (!tags.includes("website")) {
      console.warn("Missing ‘website’ tag:", artist.tags);
      return showNotFound();
    }

    // 4) Name
    document.getElementById("dj-name").textContent = artist.name || "";

    // 5) Description / Bio —
    //    Try every likely field in order
    let desc = "";
    const tryFields = [
      "descriptionHtml",
      "description",
      "bioHtml",
      "bio",
      "aboutHtml",
      "about"
    ];
    for (const f of tryFields) {
      if (typeof artist[f] === "string" && artist[f].trim()) {
        desc = artist[f];
        console.log(`✔️ using ${f} for bio`);
        break;
      }
    }
    // If it’s plain text, wrap paragraphs
    if (desc && !/<[a-z][\s\S]*>/i.test(desc)) {
      desc = desc
        .split(/\r?\n+/)
        .map(p => `<p>${p}</p>`)
        .join("");
    }
    document.getElementById("dj-bio").innerHTML = desc || `<p>No bio available.</p>`;

    // 6) Artwork
    const img = document.getElementById("dj-artwork");
    img.src = artist.logo?.["512x512"] ||
              artist.logo?.default    ||
              artist.avatar          ||
              FALLBACK_ART;
    img.alt = artist.name;

    // 7) Social links
    const sl = document.getElementById("social-links");
    sl.innerHTML = "";
    for (const [plat, url] of Object.entries(artist.socials || {})) {
      if (!url) continue;
      const label = plat
        .replace(/Handle$/,'')
        .replace(/([A-Z])/g,' $1')
        .trim();
      const li = document.createElement("li");
      li.innerHTML = `<a href="${url}" target="_blank" rel="noopener">
        ${label.charAt(0).toUpperCase() + label.slice(1)}
      </a>`;
      sl.appendChild(li);
    }

    // 8) Next show → Google Calendar
    const now     = new Date().toISOString();
    const oneYear = new Date(Date.now() + 365*24*60*60*1000).toISOString();
    const schedRes = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}/schedule`
      + `?startDate=${now}&endDate=${oneYear}`,
      { headers: { "x-api-key": API_KEY } }
    );
    const calBtn = document.getElementById("calendar-btn");
    if (schedRes.ok) {
      const { schedules = [] } = await schedRes.json();
      if (schedules.length) {
        const { startDateUtc, endDateUtc } = schedules[0];
        calBtn.href = createGoogleCalLink(
          `DJ ${artist.name} Live Set`,
          startDateUtc,
          endDateUtc
        );
      } else {
        calBtn.style.display = "none";
      }
    } else {
      calBtn.style.display = "none";
    }

    // 9) Mixcloud archives (per-artist localStorage)
    const key = `${artistId}-mixcloud-urls`;
    function loadShows() {
      const list = document.getElementById("mixes-list");
      list.innerHTML = "";
      (JSON.parse(localStorage.getItem(key))||[]).forEach(url => {
        const div = document.createElement("div");
        div.className = "mix-show";
        div.innerHTML = `
          <iframe
            src="https://www.mixcloud.com/widget/iframe/?hide_cover=1&light=1&feed=${encodeURIComponent(url)}"
            allow="autoplay"></iframe>
          <button data-url="${url}">Remove show</button>
        `;
        div.querySelector("button").onclick = () => {
          const arr = JSON.parse(localStorage.getItem(key))||[];
          localStorage.setItem(
            key,
            JSON.stringify(arr.filter(u => u !== url))
          );
          loadShows();
        };
        list.appendChild(div);
      });
    }
    loadShows();
    document.getElementById("add-show-btn").onclick = () => {
      const pwd = prompt("Enter password to add a show:");
      if (pwd !== MIXCLOUD_PW) return alert("Incorrect password");
      const input = document.getElementById("mixcloud-url-input");
      const url   = input.value.trim();
      if (!url) return;
      const arr = JSON.parse(localStorage.getItem(key))||[];
      arr.push(url);
      localStorage.setItem(key, JSON.stringify(arr));
      input.value = "";
      loadShows();
    };

  } catch (err) {
    console.error("Profile load error:", err);
    showError();
  }
}

window.addEventListener("DOMContentLoaded", initPage);
