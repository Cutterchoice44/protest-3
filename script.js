// script_IND_DJ.js
const API_KEY      = "pk_0b8abc6f834b444f949f727e88a728e0";
const BASE_URL     = "https://api.radiocult.fm/api";
const STATION_ID   = "cutters-choice-radio";
const MIXCLOUD_PW  = "cutters44";
const FALLBACK_ART = "https://i.imgur.com/qWOfxOS.png";

// 1) Helpers to show errors
function showNotFound() {
  document.body.innerHTML = `
    <p style="color:white; text-align:center; margin-top:2rem;">
      Profile not found.
    </p>`;
}
function showError() {
  document.body.innerHTML = `
    <p style="color:white; text-align:center; margin-top:2rem;">
      Error loading profile.
    </p>`;
}

// 2) Build Google Calendar link
function createGoogleCalLink(title, startUtc, endUtc) {
  if (!startUtc || !endUtc) return "#";
  const fmt = dt => new Date(dt)
    .toISOString()
    .replace(/-|:|\.\d{3}/g, '');
  return `https://www.google.com/calendar/render?action=TEMPLATE`
       + `&text=${encodeURIComponent(title)}`
       + `&dates=${fmt(startUtc)}/${fmt(endUtc)}`;
}

async function initPage() {
  // 3) Grab the ?id= from the URL
  const params = new URLSearchParams(window.location.search);
  const artistId = params.get("id");
  if (!artistId) return showNotFound();

  try {
    // 4) Fetch **all** artists and find ours
    const listRes = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists`,
      { headers: { "x-api-key": API_KEY } }
    );
    if (!listRes.ok) throw new Error(`Artists list API returned ${listRes.status}`);
    const listData = await listRes.json();
    const artists = listData.artists || [];
    const artist  = artists.find(a => a.id === artistId);
    if (!artist) return showNotFound();

    // 5) Only allow DJs tagged "website"
    if (!Array.isArray(artist.tags) || !artist.tags.includes("website")) {
      return showNotFound();
    }

    // 6) (Optional) Re-fetch detail to get full bio/socials, if you need it
    //     If listing already includes bioHtml & socials, you can skip this
    try {
      const detRes = await fetch(
        `${BASE_URL}/station/${STATION_ID}/artists/${artistId}`,
        { headers: { "x-api-key": API_KEY } }
      );
      if (detRes.ok) {
        const detData = await detRes.json();
        if (detData.success && detData.artist) {
          Object.assign(artist, detData.artist);
        }
      }
    } catch(_) {
      // ignore detail-fetch failures; listing data will still show
    }

    // 7) Populate Name & Bio
    document.getElementById("dj-name").textContent = artist.name || "";
    const bioEl = document.getElementById("dj-bio");
    if (artist.bioHtml) {
      bioEl.innerHTML = artist.bioHtml;
    } else {
      bioEl.innerHTML = `<p>${artist.bio || ""}</p>`;
    }

    // 8) Artwork
    const artEl = document.getElementById("dj-artwork");
    artEl.src = artist.logo?.["512x512"]
              || artist.logo?.default
              || artist.avatar
              || FALLBACK_ART;
    artEl.alt = artist.name;

    // 9) Social links
    const sl = document.getElementById("social-links");
    sl.innerHTML = "";
    for (const [plat, url] of Object.entries(artist.socials || {})) {
      if (!url) continue;
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="${url}" target="_blank" rel="noopener">
          ${plat.charAt(0).toUpperCase() + plat.slice(1)}
        </a>`;
      sl.appendChild(li);
    }

    // 10) Next show → Google Calendar
    const now     = new Date().toISOString();
    const oneYear = new Date(Date.now() + 365*24*60*60*1000).toISOString();
    const schedRes = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}/schedule`
      + `?startDate=${now}&endDate=${oneYear}`,
      { headers: { "x-api-key": API_KEY } }
    );
    const calBtn = document.getElementById("calendar-btn");
    if (schedRes.ok) {
      const schedData = await schedRes.json();
      const schedules = schedData.schedules || [];
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

    // 11) Mixcloud archives (per-artist localStorage)
    const storageKey = `${artistId}-mixcloud-urls`;
    function loadShows() {
      const list = document.getElementById("mixes-list");
      list.innerHTML = "";
      (JSON.parse(localStorage.getItem(storageKey)) || [])
      .forEach(url => {
        const div = document.createElement("div");
        div.className = "mix-show";
        div.innerHTML = `
          <iframe
            src="https://www.mixcloud.com/widget/iframe/?hide_cover=1&light=1&feed=${encodeURIComponent(url)}"
            allow="autoplay"></iframe>
          <button data-url="${url}">Remove show</button>
        `;
        div.querySelector("button").onclick = () => {
          const arr = JSON.parse(localStorage.getItem(storageKey)) || [];
          localStorage.setItem(
            storageKey,
            JSON.stringify(arr.filter(u => u !== url))
          );
          loadShows();
        };
        list.appendChild(div);
      });
    }
    loadShows();

    // 12) “Add Show” button
    document.getElementById("add-show-btn").onclick = () => {
      const pwd = prompt("Enter password to add a show:");
      if (pwd !== MIXCLOUD_PW) return alert("Incorrect password");
      const input = document.getElementById("mixcloud-url-input");
      const url   = input.value.trim();
      if (!url) return;
      const arr = JSON.parse(localStorage.getItem(storageKey)) || [];
      arr.push(url);
      localStorage.setItem(storageKey, JSON.stringify(arr));
      input.value = "";
      loadShows();
    };

  } catch (err) {
    console.error("Profile load error:", err);
    showError();
  }
}

window.addEventListener("DOMContentLoaded", initPage);
