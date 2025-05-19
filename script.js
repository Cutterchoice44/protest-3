// script_IND_DJ.js
const API_KEY      = "pk_0b8abc6f834b444f949f727e88a728e0";
const BASE_URL     = "https://api.radiocult.fm/api";
const STATION_ID   = "cutters-choice-radio";
const MIXCLOUD_PW  = "cutters44";
const FALLBACK_ART = "https://i.imgur.com/qWOfxOS.png";

// Show a “not found” message in the wrapper
function showNotFound() {
  const w = document.querySelector('.profile-wrapper');
  if (w) w.innerHTML = `
    <p style="color:white;text-align:center;margin:2rem;">
      Profile not found.
    </p>`;
}

// Show a generic error
function showError() {
  const w = document.querySelector('.profile-wrapper');
  if (w) w.innerHTML = `
    <p style="color:white;text-align:center;margin:2rem;">
      Error loading profile.
    </p>`;
}

// Build a Google Calendar link
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
  const params   = new URLSearchParams(location.search);
  const artistId = params.get("id");
  if (!artistId) return showNotFound();

  try {
    // Fetch the artist record
    const res = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}`,
      { headers: { "x-api-key": API_KEY } }
    );
    if (!res.ok) {
      if (res.status === 404) return showNotFound();
      throw new Error(`Artist API returned ${res.status}`);
    }

    const payload = await res.json();
    // Unwrap common wrappers
    let artist = payload.artist || payload.data || payload;
    if (artist.attributes) artist = { ...artist, ...artist.attributes };

    // Only DJs tagged "website"
    const tags = Array.isArray(artist.tags)
      ? artist.tags.map(t => String(t).toLowerCase())
      : [];
    if (!tags.includes("website")) {
      return showNotFound();
    }

    // Populate Name
    document.getElementById("dj-name").textContent = artist.name || "";

    // Render Description (TipTap or string)
    const bioEl = document.getElementById("dj-bio");
    let raw = null;
    for (const key of ["description", "descriptionHtml", "bio", "bioHtml"]) {
      if (artist[key] != null) {
        raw = artist[key];
        break;
      }
    }

    let html = "";
    if (raw) {
      // TipTap JSON
      if (typeof raw === "object" && Array.isArray(raw.content)) {
        const extractText = node => {
          if (node.text) return node.text;
          if (node.content) return node.content.map(extractText).join("");
          return "";
        };
        html = raw.content
          .map(block => `<p>${extractText(block)}</p>`)
          .join("");
      }
      // String: HTML or plain
      else if (typeof raw === "string") {
        if (/<[a-z][\s\S]*>/i.test(raw)) {
          html = raw;
        } else {
          html = raw
            .split(/\r?\n+/)
            .map(p => `<p>${p}</p>`)
            .join("");
        }
      }
    }
    bioEl.innerHTML = html || `<p>No bio available.</p>`;

    // Artwork
    const art = document.getElementById("dj-artwork");
    art.src = artist.logo?.["512x512"]
           || artist.logo?.default
           || artist.avatar
           || FALLBACK_ART;
    art.alt = artist.name || "";

    // Social links
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

    // Next show → Google Calendar
  const schedRes = await fetch(/* … */);
const calBtn = document.getElementById("calendar-btn");

if (schedRes.ok) {
  const { schedules = [] } = await schedRes.json();
  console.log("Schedule data:", schedules);
  if (schedules.length) {
    // We have a show—build the link…
    const { startDateUtc, endDateUtc } = schedules[0];
    calBtn.href = createGoogleCalLink(
      `DJ ${artist.name} Live Set`,
      startDateUtc,
      endDateUtc
    );
    // …and make sure the icon is visible:
    calBtn.style.display = "inline-block";
  } else {
    // No upcoming show
    calBtn.style.display = "none";
  }
} else {
  // API error
  calBtn.style.display = "none";
}

    // Mixcloud archives (localStorage)
    const key = `${artistId}-mixcloud-urls`;
    const loadShows = () => {
      const list = document.getElementById("mixes-list");
      list.innerHTML = "";
      (JSON.parse(localStorage.getItem(key)) || []).forEach(url => {
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
          const arr = JSON.parse(localStorage.getItem(key)) || [];
          localStorage.setItem(key,
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
      const input = document.getElementById("mixcloud-url-input");
      const url   = input.value.trim();
      if (!url) return;
      const arr = JSON.parse(localStorage.getItem(key)) || [];
      arr.push(url);
      localStorage.setItem(key, JSON.stringify(arr));
      input.value = "";
      loadShows();
    };

  } catch (err) {
    console.error("Error loading profile:", err);
    showError();
  }
}

window.addEventListener("DOMContentLoaded", initPage);
