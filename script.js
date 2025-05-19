// script_IND_DJ.js
const API_KEY      = "pk_0b8abc6f834b444f949f727e88a728e0";
const BASE_URL     = "https://api.radiocult.fm/api";
const STATION_ID   = "cutters-choice-radio";
const MIXCLOUD_PW  = "cutters44";
const FALLBACK_ART = "https://i.imgur.com/qWOfxOS.png";

// Helpers to show error / not-found
function showNotFound() {
  document.querySelector(".profile-wrapper").innerHTML = `
    <p style="color:white;text-align:center;margin:2rem;">
      Profile not found.
    </p>`;
}
function showError() {
  document.querySelector(".profile-wrapper").innerHTML = `
    <p style="color:white;text-align:center;margin:2rem;">
      Error loading profile.
    </p>`;
}

// Build a Google Calendar link
function createGoogleCalLink(title, startUtc, endUtc) {
  if (!startUtc || !endUtc) return "#";
  const fmt = dt => new Date(dt)
    .toISOString()
    .replace(/-|:|\.\d{3}/g, "");
  return `https://www.google.com/calendar/render?action=TEMPLATE`
       + `&text=${encodeURIComponent(title)}`
       + `&dates=${fmt(startUtc)}/${fmt(endUtc)}`;
}

async function initPage() {
  const params   = new URLSearchParams(location.search);
  const artistId = params.get("id");
  if (!artistId) return showNotFound();

  // 1) Load artist
  let artist;
  try {
    const res = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}`,
      { headers:{ "x-api-key": API_KEY } }
    );
    if (!res.ok) {
      if (res.status === 404) return showNotFound();
      throw new Error("Artist API "+res.status);
    }
    const payload = await res.json();
    artist = payload.artist || payload.data || payload;
    if (artist.attributes) artist = { ...artist, ...artist.attributes };
  } catch(err) {
    console.error(err);
    return showError();
  }

  // 2) Only DJs tagged “website”
  const tags = Array.isArray(artist.tags)
    ? artist.tags.map(t=>String(t).toLowerCase())
    : [];
  if (!tags.includes("website")) {
    return showNotFound();
  }

  // 3) Populate name
  document.getElementById("dj-name").textContent = artist.name || "";

  // 4) Populate bio/description (TipTap JSON or string)
  const bioEl = document.getElementById("dj-bio");
  let raw = null;
  for (const key of ["description","descriptionHtml","bio","bioHtml"]) {
    if (artist[key] != null) {
      raw = artist[key];
      break;
    }
  }
  let bioHtml = "";
  if (raw) {
    // TipTap JSON?
    if (typeof raw==="object" && Array.isArray(raw.content)) {
      const extract = node => 
        node.text || (node.content||[]).map(extract).join("") || "";
      bioHtml = raw.content.map(block=>
        `<p>${extract(block)}</p>`
      ).join("");
    }
    // string
    else if (typeof raw==="string") {
      if (/<[a-z][\s\S]*>/i.test(raw)) bioHtml = raw;
      else bioHtml = raw.split(/\r?\n+/).map(p=>`<p>${p}</p>`).join("");
    }
  }
  bioEl.innerHTML = bioHtml || `<p>No bio available.</p>`;

  // 5) Artwork
  const art = document.getElementById("dj-artwork");
  art.src = artist.logo?.["512x512"]||artist.logo?.default||artist.avatar||FALLBACK_ART;
  art.alt = artist.name||"";

  // 6) Social links
  const sl = document.getElementById("social-links");
  sl.innerHTML = "";
  for (const [plat,url] of Object.entries(artist.socials||{})) {
    if (!url) continue;
    const label = plat.replace(/Handle$/,"").replace(/([A-Z])/g," $1").trim();
    const li = document.createElement("li");
    li.innerHTML = `<a href="${url}" target="_blank" rel="noopener">
      ${label.charAt(0).toUpperCase()+label.slice(1)}
    </a>`;
    sl.appendChild(li);
  }

  // 7) “Add to Calendar” button
  const calBtn = document.getElementById("calendar-btn");
  calBtn.disabled = true;
  calBtn.onclick  = null;
  try {
    const now     = new Date().toISOString();
    const oneYear = new Date(Date.now()+365*24*60*60*1000).toISOString();
    const r2 = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}/schedule`
      + `?startDate=${now}&endDate=${oneYear}`,
      { headers:{ "x-api-key": API_KEY } }
    );
    if (r2.ok) {
      const { schedules=[] } = await r2.json();
      if (schedules.length) {
        const { startDateUtc,endDateUtc } = schedules[0];
        calBtn.disabled = false;
        calBtn.onclick = () => {
          window.open(createGoogleCalLink(
            `DJ ${artist.name} Live Set`,
            startDateUtc,
            endDateUtc
          ), "_blank");
        };
      }
    }
  } catch(e) {
    console.error("Schedule error:",e);
  }

  // 8) Mixcloud archive — persisted in localStorage
  const storageKey = `${artistId}-mixcloud-urls`;
  const listEl     = document.getElementById("mixes-list");
  function loadShows() {
    listEl.innerHTML = "";
    (JSON.parse(localStorage.getItem(storageKey))||[])
    .forEach(url=>{
      const div = document.createElement("div");
      div.className = "mix-show";
      div.innerHTML = `
        <iframe
          src="https://www.mixcloud.com/widget/iframe/
            ?hide_cover=1&light=1&feed=${encodeURIComponent(url)}"
          allow="autoplay"></iframe>
        <button data-url="${url}">Remove show</button>
      `;
      div.querySelector("button").onclick = () => {
        const arr = JSON.parse(localStorage.getItem(storageKey))||[];
        localStorage.setItem(storageKey,
          JSON.stringify(arr.filter(u=>u!==url))
        );
        loadShows();
      };
      listEl.appendChild(div);
    });
  }
  // initial render
  loadShows();
  // add-show handler
  document.getElementById("add-show-btn").onclick = () => {
    const pwd = prompt("Enter password to add a show:");
    if (pwd!==MIXCLOUD_PW) return alert("Incorrect password");
    const input = document.getElementById("mixcloud-url-input");
    const url   = input.value.trim();
    if (!url) return;
    const arr = JSON.parse(localStorage.getItem(storageKey))||[];
    arr.push(url);
    localStorage.setItem(storageKey,JSON.stringify(arr));
    input.value="";
    loadShows();
  };

} // end initPage

window.addEventListener("DOMContentLoaded", initPage);
