// script.js
const API_KEY      = "pk_0b8abc6f834b444f949f727e88a728e0";
const BASE_URL     = "https://api.radiocult.fm/api";
const STATION_ID   = "cutters-choice-radio";
const MIXCLOUD_PW  = "cutters44";
const FALLBACK_ART = "https://i.imgur.com/qWOfxOS.png";

// Build a Google Calendar link from UTC datetimes
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
  // 1) Grab the ?id= from URL
  const params   = new URLSearchParams(window.location.search);
  const artistId = params.get("id");
  if (!artistId) {
    document.body.innerHTML = `
      <p style="color:white;text-align:center;margin-top:2rem;">
        Profile not found.
      </p>`;
    return;
  }

  try {
    // 2) Fetch the artist by ID (station-scoped)
    const resArtist = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}`,
      { headers: { "x-api-key": API_KEY } }
    );
    if (!resArtist.ok) throw new Error(`Artist API returned ${resArtist.status}`);
    const artist = await resArtist.json();

    // Only proceed if tagged “website”
    const tags = Array.isArray(artist.tags)
      ? artist.tags.map(t => t.toLowerCase())
      : [];
    if (!tags.includes("website")) {
      document.body.innerHTML = `
        <p style="color:white;text-align:center;margin-top:2rem;">
          Profile not available.
        </p>`;
      return;
    }

    // 3) Populate name & bio
    document.getElementById("dj-name").textContent = artist.name;
    const bioEl = document.getElementById("dj-bio");
    bioEl.innerHTML = artist.bioHtml
      ? artist.bioHtml
      : `<p>${artist.bio || ""}</p>`;

    // 4) Artwork
    const artEl = document.getElementById("dj-artwork");
    artEl.src = artist.logo?.["512x512"]
      || artist.logo?.default
      || artist.avatar
      || FALLBACK_ART;
    artEl.alt = artist.name;

    // 5) Social links
    const sl = document.getElementById("social-links");
    sl.innerHTML = "";
    for (const [plat, url] of Object.entries(artist.socialLinks || {})) {
      if (!url) continue;
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="${url}" target="_blank" rel="noopener">
          ${plat.charAt(0).toUpperCase() + plat.slice(1)}
        </a>`;
      sl.appendChild(li);
    }

    // 6) Next show → calendar button
    const now     = new Date().toISOString();
    const oneYear = new Date(Date.now() + 365*24*60*60*1000).toISOString();
    const resSched = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}/schedule`
      + `?startDate=${now}&endDate=${oneYear}`,
      { headers: { "x-api-key": API_KEY } }
    );
    const calBtn = document.getElementById("calendar-btn");
    if (resSched.ok) {
      const { schedules = [] } = await resSched.json();
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

    // 7) Mixcloud archives (per-artist localStorage)
    const storageKey = `${artistId}-mixcloud-urls`;
    const loadShows = () => {
      const list = document.getElementById("mixes-list");
      list.innerHTML = "";
      (JSON.parse(localStorage.getItem(storageKey)) || [])
      .forEach(url => {
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
          const arr = JSON.parse(localStorage.getItem(storageKey)) || [];
          localStorage.setItem(
            storageKey,
            JSON.stringify(arr.filter(u => u !== url))
          );
          loadShows();
        };
        list.appendChild(div);
      });
    };
    loadShows();

    document.getElementById("add-show-btn").onclick = () => {
      const pwd = prompt("Enter password to add a show:");
      if (pwd !== MIXCLOUD_PW) return alert("Incorrect password");
      const url = document.getElementById("mixcloud-url-input").value.trim();
      if (!url) return;
      const arr = JSON.parse(localStorage.getItem(storageKey)) || [];
      arr.push(url);
      localStorage.setItem(storageKey, JSON.stringify(arr));
      document.getElementById("mixcloud-url-input").value = "";
      loadShows();
    };

  } catch (err) {
    console.error("Profile load error:", err);
    document.body.innerHTML = `
      <p style="color:white;text-align:center;margin-top:2rem;">
        Error loading profile.
      </p>`;
  }
}

window.addEventListener("DOMContentLoaded", initPage);
