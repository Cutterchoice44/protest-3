// script_IND_DJ.js
const API_KEY      = "pk_0b8abc6f834b444f949f727e88a728e0";
const BASE_URL     = "https://api.radiocult.fm/api";
const STATION_ID   = "cutters-choice-radio";
const MIXCLOUD_PW  = "cutters44";
const FALLBACK_ART = "https://i.imgur.com/qWOfxOS.png";

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

function createGoogleCalLink(title, startUtc, endUtc) {
  if (!startUtc || !endUtc) return "#";
  const fmt = dt=>new Date(dt).toISOString().replace(/-|:|\.\d{3}/g,'');
  return `https://www.google.com/calendar/render?action=TEMPLATE`
       + `&text=${encodeURIComponent(title)}`
       + `&dates=${fmt(startUtc)}/${fmt(endUtc)}`;
}

async function initPage() {
  console.clear();
  const params   = new URLSearchParams(window.location.search);
  const artistId = params.get("id");
  if (!artistId) return showNotFound();

  try {
    const res = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}`,
      { headers: { "x-api-key": API_KEY } }
    );
    if (!res.ok) {
      if (res.status === 404) return showNotFound();
      throw new Error(`Artist API returned ${res.status}`);
    }

    const payload = await res.json();
    console.log("▶️ Raw payload:", payload);

    // Unwrap any common wrapper shapes:
    let artist = payload;
    if (payload.artist) {
      artist = payload.artist;
    } else if (payload.data) {
      // e.g. { data: { artist: {...} } } or { data: {...} }
      artist = payload.data.artist || payload.data;
    }
    // If your API nests under .attributes (Strapi style)
    if (artist.attributes) {
      artist = { ...artist, ...artist.attributes };
    }
    console.log("🏷️ Final artist object:", artist);

    // Only load DJs tagged “website”
    const tags = Array.isArray(artist.tags)
      ? artist.tags.map(t => String(t).toLowerCase())
      : [];
    if (!tags.includes("website")) {
      return showNotFound();
    }

    // Name
    document.getElementById("dj-name").textContent = artist.name || "";

    // ——— Description / Bio ———
    const bioEl = document.getElementById("dj-bio");
    let rawDesc = null;
    // pick whichever field actually exists in your artist object
    for (const key of [
      "description",
      "descriptionHtml",
      "bio",
      "bioHtml",
      "about",
      "aboutHtml"
    ]) {
      if (artist[key] != null) {
        rawDesc = artist[key];
        console.log(`✔️ using field “${key}” for bio:`, rawDesc);
        break;
      }
    }

    let descHtml = "";
    // If it’s TipTap / ProseMirror JSON:
    if (rawDesc && typeof rawDesc === "object" && Array.isArray(rawDesc.content)) {
      descHtml = rawDesc.content
        .filter(n => n.type === "paragraph")
        .map(p => `<p>${(p.content||[]).map(t=>t.text||"").join("")}</p>`)
        .join("");
    }
    // Otherwise if it’s a string:
    else if (typeof rawDesc === "string") {
      if (/<[a-z][\s\S]*>/i.test(rawDesc)) {
        descHtml = rawDesc;  // already HTML
      } else {
        descHtml = rawDesc
          .split(/\r?\n+/)
          .map(p => `<p>${p}</p>`)
          .join("");
      }
    }
    bioEl.innerHTML = descHtml || `<p>No bio available.</p>`;

    // Artwork
    const art = document.getElementById("dj-artwork");
    art.src = artist.logo?.["512x512"] || artist.logo?.default || artist.avatar || FALLBACK_ART;
    art.alt = artist.name || "";

    // Socials
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
        ${label.charAt(0).toUpperCase()+label.slice(1)}
      </a>`;
      sl.appendChild(li);
    }

    // Next show → Calendar
    const now     = new Date().toISOString();
    const nextYear= new Date(Date.now()+365*24*60*60*1000).toISOString();
    const sched   = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}/schedule`
      + `?startDate=${now}&endDate=${nextYear}`,
      { headers: { "x-api-key": API_KEY } }
    ).then(r=>r.ok? r.json(): { schedules: [] });
    const calBtn = document.getElementById("calendar-btn");
    if (sched.schedules?.length) {
      const { startDateUtc, endDateUtc } = sched.schedules[0];
      calBtn.href = createGoogleCalLink(
        `DJ ${artist.name} Live Set`, startDateUtc, endDateUtc
      );
    } else {
      calBtn.style.display = "none";
    }

    // Mixcloud archive (localStorage)
    const storageKey = `${artistId}-mixcloud-urls`;
    function loadShows() {
      const list = document.getElementById("mixes-list");
      list.innerHTML = "";
      (JSON.parse(localStorage.getItem(storageKey))||[])
      .forEach(url => {
        const div = document.createElement("div");
        div.className = "mix-show";
        div.innerHTML = `
          <iframe
            src="https://www.mixcloud.com/widget/iframe/?hide_cover=1&light=1&feed=${encodeURIComponent(url)}"
            allow="autoplay"
          ></iframe>
          <button data-url="${url}">Remove show</button>
        `;
        div.querySelector("button").onclick = () => {
          const arr = JSON.parse(localStorage.getItem(storageKey))||[];
          localStorage.setItem(storageKey,
            JSON.stringify(arr.filter(u=>u!==url))
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
      const arr = JSON.parse(localStorage.getItem(storageKey))||[];
      arr.push(url);
      localStorage.setItem(storageKey, JSON.stringify(arr));
      input.value = "";
      loadShows();
    };

  } catch (err) {
    console.error("❌ Profile load error:", err);
    showError();
  }
}

window.addEventListener("DOMContentLoaded", initPage);
