// script_IND_DJ.js
const API_KEY      = "pk_0b8abc6f834b444f949f727e88a728e0";
const BASE_URL     = "https://api.radiocult.fm/api";
const STATION_ID   = "cutters-choice-radio";
const MIXCLOUD_PW  = "cutters44";
const FALLBACK_ART = "https://i.imgur.com/qWOfxOS.png";

// Replace only the profile wrapper with an error message
function showNotFound() {
  const wrapper = document.querySelector('.profile-wrapper');
  if (wrapper) {
    wrapper.innerHTML = `
      <p style="color:white; text-align:center; margin:2rem;">
        Profile not found.
      </p>`;
  }
}
function showError() {
  const wrapper = document.querySelector('.profile-wrapper');
  if (wrapper) {
    wrapper.innerHTML = `
      <p style="color:white; text-align:center; margin:2rem;">
        Error loading profile.
      </p>`;
  }
}

// Build a Google Calendar link from UTC datetimes
function createGoogleCalLink(title, startUtc, endUtc) {
  if (!startUtc || !endUtc) return "#";
  const fmt = dt => new Date(dt)
    .toISOString()
    .replace(/-|:|\.\d{3}/g, '');
  return [
    "https://www.google.com/calendar/render?action=TEMPLATE",
    "&text=" + encodeURIComponent(title),
    "&dates=" + fmt(startUtc) + "/" + fmt(endUtc)
  ].join("");
}

async function initPage() {
  console.log("▶️ script_IND_DJ.js init");  // debug
  const params = new URLSearchParams(window.location.search);
  const artistId = params.get("id");
  if (!artistId) {
    console.warn("No ?id= in URL");
    return showNotFound();
  }
  console.log("Looking up artistId =", artistId);

  try {
    // 1) Fetch all artists, then find ours
    const listRes = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists`,
      { headers: { "x-api-key": API_KEY } }
    );
    if (!listRes.ok) throw new Error(`List API ${listRes.status}`);
    const listData = await listRes.json();
    const artists = listData.artists || [];
    const artist  = artists.find(a => a.id === artistId);
    if (!artist) {
      console.warn("Artist not in list");
      return showNotFound();
    }

    // 2) Only show DJs tagged "website"
    if (!Array.isArray(artist.tags) || !artist.tags.map(t=>t.toLowerCase()).includes("website")) {
      console.warn("Missing website tag:", artist.tags);
      return showNotFound();
    }
    console.log("✅ Found artist:", artist.name);

    // 3) Populate Name & Bio
    document.getElementById("dj-name").textContent = artist.name || "";
    const bioEl = document.getElementById("dj-bio");
    if (artist.bioHtml) {
      bioEl.innerHTML = artist.bioHtml;
    } else {
      bioEl.innerHTML = `<p>${artist.bio||""}</p>`;
    }

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
    for (const [plat, url] of Object.entries(artist.socials || {})) {
      if (!url) continue;
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="${url}" target="_blank" rel="noopener">
          ${plat.charAt(0).toUpperCase() + plat.slice(1)}
        </a>`;
      sl.appendChild(li);
    }

    // 6) Next show → calendar
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

    // 7) Mixcloud archives (per‐artist localStorage)
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
              allow="autoplay"></iframe>
            <button data-url="${url}">Remove show</button>
          `;
          div.querySelector("button").onclick = () => {
            const arr = JSON.parse(localStorage.getItem(storageKey))||[];
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

    // Add-show button
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
    console.error("Profile load error:", err);
    showError();
  }
}

window.addEventListener("DOMContentLoaded", initPage);
