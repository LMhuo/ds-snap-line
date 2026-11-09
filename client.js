window.__ModuleLoader__.load({
  id: 'dsh-snap-line',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /* Rope: quadratic from (18,14) to (682,14) with control point (350,46). */
    const ROPE_LEFT = 18;
    const ROPE_RIGHT = 682;
    const ROPE_TOP = 14;
    const ROPE_SAG = 32;

    function ropeY(x) {
      const t = (x - ROPE_LEFT) / (ROPE_RIGHT - ROPE_LEFT);
      return ROPE_TOP + 2 * ROPE_SAG * t * (1 - t);
    }

    const CSS = `
      .sl-sway {
        transform-box: fill-box;
        transform-origin: 50% 7px;
        animation: sl-sway 6.8s ease-in-out infinite;
      }
      @keyframes sl-sway {
        0%, 100% { transform: rotate(-1.15deg); }
        50% { transform: rotate(1.15deg); }
      }
      .sl-wobble {
        transform-box: fill-box;
        transform-origin: 50% 7px;
      }
      @keyframes sl-wobble {
        0% { transform: rotate(0deg); }
        14% { transform: rotate(2.8deg); }
        34% { transform: rotate(-2.1deg); }
        54% { transform: rotate(1.45deg); }
        74% { transform: rotate(-0.8deg); }
        90% { transform: rotate(0.35deg); }
        100% { transform: rotate(0deg); }
      }
      /*
       * The wrapper is pointer-events: none so the artwork never steals clicks
       * from the composer. Each photo frame opts back in so it can be hovered
       * and clicked; the rest of the SVG stays transparent to the pointer. The
       * nudge itself is transform-only: no layout, no JS listeners and no React
       * re-renders while it plays.
       */
      .sl-photo {
        pointer-events: auto;
        touch-action: manipulation;
      }
      @media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
        .sl-photo:hover .sl-wobble {
          animation: sl-wobble 1.25s ease-in-out;
        }
      }
      .sl-lightbox {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: grid;
        pointer-events: auto;
        place-items: center;
        padding: 24px;
        background: rgba(20, 17, 13, 0.62);
        animation: sl-lightbox-fade 160ms ease-out;
      }
      .sl-lightbox-photo {
        display: inline-block;
        max-width: 92vw;
        padding: 12px;
        background: #fcf8ef;
        border-radius: 4px;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
        animation: sl-lightbox-pop 200ms ease-out;
      }
      .sl-lightbox-photo img {
        display: block;
        width: auto;
        height: auto;
        max-width: min(88vw, 1200px);
        max-height: 78vh;
        border-radius: 1px;
      }
      .sl-lightbox-polaroid {
        width: min(360px, 72vw);
        animation: sl-lightbox-pop 200ms ease-out;
      }
      .sl-lightbox-polaroid svg {
        display: block;
        width: 100%;
        height: auto;
      }
      .sl-lightbox-close {
        position: absolute;
        top: 18px;
        right: 20px;
        width: 40px;
        height: 40px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: #fcf8ef;
        color: #3c352c;
        font-family: inherit;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
      }
      .sl-lightbox-close:hover {
        background: #ffffff;
      }
      @keyframes sl-lightbox-fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes sl-lightbox-pop {
        from { transform: scale(0.94); }
        to { transform: scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .sl-sway { animation: none; }
        .sl-lightbox,
        .sl-lightbox-photo,
        .sl-lightbox-polaroid { animation: none; }
      }
    `;

    const defs = h('defs', null,
      h('linearGradient', { id: 'slSunset', x1: '0', y1: '0', x2: '0', y2: '1' },
        h('stop', { offset: '0%', stopColor: '#ffd27a' }),
        h('stop', { offset: '52%', stopColor: '#ff9d76' }),
        h('stop', { offset: '100%', stopColor: '#ea6a7c' })),
      h('linearGradient', { id: 'slSea', x1: '0', y1: '0', x2: '0', y2: '1' },
        h('stop', { offset: '0%', stopColor: '#4a7e9e' }),
        h('stop', { offset: '100%', stopColor: '#1e405c' })),
      h('linearGradient', { id: 'slMountainSky', x1: '0', y1: '0', x2: '0', y2: '1' },
        h('stop', { offset: '0%', stopColor: '#b9def7' }),
        h('stop', { offset: '100%', stopColor: '#eef8ff' })),
      h('linearGradient', { id: 'slNight', x1: '0', y1: '0', x2: '0', y2: '1' },
        h('stop', { offset: '0%', stopColor: '#141c33' }),
        h('stop', { offset: '100%', stopColor: '#35486f' })),
      h('linearGradient', { id: 'slMeadowSky', x1: '0', y1: '0', x2: '0', y2: '1' },
        h('stop', { offset: '0%', stopColor: '#cfeaff' }),
        h('stop', { offset: '100%', stopColor: '#ffe9ef' })),
      h('linearGradient', { id: 'slGrass', x1: '0', y1: '0', x2: '0', y2: '1' },
        h('stop', { offset: '0%', stopColor: '#6aa84f' }),
        h('stop', { offset: '100%', stopColor: '#3f7a35' })),
      h('linearGradient', { id: 'slBalloonSky', x1: '0', y1: '0', x2: '0', y2: '1' },
        h('stop', { offset: '0%', stopColor: '#d6ecff' }),
        h('stop', { offset: '100%', stopColor: '#fff3da' })),
      h('linearGradient', { id: 'slHills', x1: '0', y1: '0', x2: '0', y2: '1' },
        h('stop', { offset: '0%', stopColor: '#8fc27a' }),
        h('stop', { offset: '100%', stopColor: '#5f9c55' })),
      h('linearGradient', { id: 'slGlare', x1: '0', y1: '0', x2: '0.85', y2: '1' },
        h('stop', { offset: '0%', stopColor: '#ffffff', stopOpacity: '0.16' }),
        h('stop', { offset: '55%', stopColor: '#ffffff', stopOpacity: '0' })),
      h('clipPath', { id: 'slClip' },
        h('rect', { x: -26, y: 11, width: 52, height: 52, rx: 1.6 })),
    );

    function peg() {
      return h('g', null,
        h('rect', { x: -3.4, y: -6, width: 6.8, height: 13, rx: 1.4, fill: '#cf9e60', stroke: '#8d6335', strokeWidth: 0.7 }),
        h('rect', { x: -2.5, y: -4.4, width: 1.5, height: 8, rx: 0.7, fill: '#e8c18b', opacity: 0.9 }),
        h('rect', { x: -4.6, y: -0.5, width: 9.2, height: 2.1, rx: 1, fill: '#aeb6bf' }),
        h('rect', { x: -4.6, y: -0.5, width: 9.2, height: 0.8, rx: 0.4, fill: '#d6dde3', opacity: 0.85 }),
      );
    }

    function frame(content) {
      return h('g', null,
        h('rect', { x: -29.4, y: 7.8, width: 62, height: 80, rx: 3.4, fill: '#000000', opacity: 0.09 }),
        h('rect', { x: -31, y: 6, width: 62, height: 80, rx: 3.4, fill: '#fcf8ef', stroke: '#d8ccb6', strokeWidth: 0.8 }),
        content,
        h('rect', { x: -26, y: 11, width: 52, height: 52, rx: 1.6, fill: 'url(#slGlare)' }),
        h('path', { d: 'M-13 79.5 q6.5 -2.6 13 0 q6.5 -2.6 13 0', fill: 'none', stroke: '#cfc3ad', strokeWidth: 1.1, strokeLinecap: 'round' }),
      );
    }

    /* Five little illustrated photographs. */
    function sceneSunset() {
      return h('g', { clipPath: 'url(#slClip)' },
        h('rect', { x: -26, y: 11, width: 52, height: 36, fill: 'url(#slSunset)' }),
        h('circle', { cx: 5, cy: 40, r: 12, fill: '#ffe2a3', opacity: 0.22 }),
        h('circle', { cx: 5, cy: 40, r: 8.5, fill: '#ffe2a3' }),
        h('path', { d: 'M-26 46 H26 V63 H-26 Z', fill: 'url(#slSea)' }),
        h('path', { d: 'M-26 46 Q-12 44.5 0 46 T26 46', fill: 'none', stroke: '#f6cd93', strokeWidth: 1.1, opacity: 0.65 }),
        h('path', { d: 'M-20 53 q4 -1.6 8 0 t8 0', fill: 'none', stroke: '#ffffff', strokeWidth: 0.9, opacity: 0.35 }),
        h('path', { d: 'M-10 58 q4 -1.6 8 0 t8 0', fill: 'none', stroke: '#ffffff', strokeWidth: 0.9, opacity: 0.28 }),
        h('path', { d: 'M-15 27 q3 -3 6 0 M2 22 q2.5 -2.5 5 0', fill: 'none', stroke: '#8c5a4d', strokeWidth: 1, strokeLinecap: 'round', opacity: 0.75 }),
      );
    }

    function sceneMountains() {
      return h('g', { clipPath: 'url(#slClip)' },
        h('rect', { x: -26, y: 11, width: 52, height: 52, fill: 'url(#slMountainSky)' }),
        h('circle', { cx: -13, cy: 25, r: 5.5, fill: '#fff3c4' }),
        h('path', { d: 'M-26 63 L-12 41 L-2 52 L9 30 L26 63 Z', fill: '#a9bfd0' }),
        h('path', { d: 'M9 30 L5.4 38 L12.6 38 Z', fill: '#f4f9ff' }),
        h('path', { d: 'M-26 63 L-6 47 L6 56 L17 46 L26 63 Z', fill: '#7d99ad' }),
        h('path', { d: 'M17 46 L14 51 L20 51 Z', fill: '#eef6fc' }),
        h('path', { d: 'M-26 63 L-22 58 L-18 63 Z', fill: '#56707f' }),
      );
    }

    function sceneNight() {
      const stars = [[-18, 20], [-8, 31], [-1, 18], [17, 18], [20, 33], [-20, 36], [1, 37]];
      return h('g', { clipPath: 'url(#slClip)' },
        h('rect', { x: -26, y: 11, width: 52, height: 52, fill: 'url(#slNight)' }),
        h('circle', { cx: 8, cy: 25, r: 7.5, fill: '#f7e8b6' }),
        h('circle', { cx: 5.6, cy: 22.5, r: 1.5, fill: '#e3cf95', opacity: 0.8 }),
        h('circle', { cx: 10.5, cy: 27.5, r: 1.1, fill: '#e3cf95', opacity: 0.7 }),
        stars.map(([x, y], i) => h('circle', { key: i, cx: x, cy: y, r: 0.7, fill: '#ffffff', opacity: 0.9 })),
        h('path', { d: 'M-26 63 L-13 49 L-4 57 L6 47 L15 55 L22 50 L26 63 Z', fill: '#101a30' }),
      );
    }

    function sceneMeadow() {
      const blossoms = [[-14, 51, '#f6a6c1'], [1, 46, '#f7e08a'], [14, 52, '#c9b6f2']];
      return h('g', { clipPath: 'url(#slClip)' },
        h('rect', { x: -26, y: 11, width: 52, height: 30, fill: 'url(#slMeadowSky)' }),
        h('circle', { cx: 16, cy: 22, r: 4.5, fill: '#fff4c9' }),
        h('path', { d: 'M-26 41 Q-6 36 12 41 T26 40 V63 H-26 Z', fill: 'url(#slGrass)' }),
        blossoms.map(([x, y, color], i) => h('g', { key: i },
          h('path', { d: 'M' + x + ' ' + (y + 8) + ' Q' + (x + 1.6) + ' ' + (y + 4) + ' ' + x + ' ' + y, fill: 'none', stroke: '#4f7a3f', strokeWidth: 1 }),
          h('circle', { cx: x - 2, cy: y - 1.6, r: 1.5, fill: color }),
          h('circle', { cx: x + 2, cy: y - 1.6, r: 1.5, fill: color }),
          h('circle', { cx: x, cy: y - 4, r: 1.5, fill: color }),
          h('circle', { cx: x, cy: y - 0.6, r: 1.4, fill: '#f3c14a' }),
        )),
        h('path', { d: 'M-21 24 q2.4 -3 4.8 0 q2.4 -3 4.8 0', fill: 'none', stroke: '#7f8ec9', strokeWidth: 1, opacity: 0.8 }),
      );
    }

    function sceneBalloon() {
      return h('g', { clipPath: 'url(#slClip)' },
        h('rect', { x: -26, y: 11, width: 52, height: 52, fill: 'url(#slBalloonSky)' }),
        h('ellipse', { cx: -14, cy: 22, rx: 7, ry: 3, fill: '#ffffff', opacity: 0.85 }),
        h('ellipse', { cx: 13, cy: 18, rx: 8, ry: 3.2, fill: '#ffffff', opacity: 0.75 }),
        h('path', { d: 'M-26 63 L-8 47 L6 56 L18 45 L26 63 Z', fill: 'url(#slHills)' }),
        h('g', { transform: 'translate(4 24)' },
          h('path', { d: 'M0 -14 C 11 -14 13 -4 6 4 L0 9 L-6 4 C -13 -4 -11 -14 0 -14 Z', fill: '#e2695b' }),
          h('path', { d: 'M0 -14 C 4 -14 5 -4 3 6 L0 9 L-3 6 C -5 -4 -4 -14 0 -14 Z', fill: '#f4d06f' }),
          h('path', { d: 'M-5 8 L-3 16 M5 8 L3 16', fill: 'none', stroke: '#8a6c4a', strokeWidth: 0.8 }),
          h('rect', { x: -3, y: 15.5, width: 6, height: 4.2, rx: 1, fill: '#a97b45', stroke: '#7c572d', strokeWidth: 0.6 }),
        ),
      );
    }

    const PHOTO_SCALE = 0.82;

    /* Illustrations shown while the photos folder has no images. */
    const ILLUSTRATIONS = [sceneSunset, sceneMountains, sceneNight, sceneMeadow, sceneBalloon];

    const TILTS = [-2.2, 1.4, -1.1, 2.0, -1.6, 0.9];
    const DELAYS = ['0s', '-1.8s', '-3.2s', '-0.7s', '-2.5s', '-4.1s'];
    const DURATIONS = ['7.6s', '6.8s', '8.2s', '7.1s', '6.5s', '7.8s'];
    const MAX_PHOTOS = 6;
    const PHOTO_ENDPOINT = '/dsh-snap-line/photos.json';
    const POLL_INTERVAL_MS = 5000;

    /** Evenly spread photo centers along the rope, capped at the old five-photo spacing. */
    function photoPositions(count) {
      if (count <= 1) return [350];
      const spacing = Math.min(116, 464 / (count - 1));
      const first = 350 - (spacing * (count - 1)) / 2;
      return Array.from({ length: count }, (_, index) => Math.round((first + spacing * index) * 100) / 100);
    }

    function samplePhotos(photos, limit) {
      if (photos.length <= limit) return photos;
      const picked = [];
      for (let index = 0; index < limit; index += 1) {
        picked.push(photos[Math.round((index * (photos.length - 1)) / (limit - 1))]);
      }
      return picked;
    }

    /** Poll the host's photo listing so dropped or removed images show up on their own. */
    function usePhotoList() {
      const [photos, setPhotos] = React.useState(null);
      React.useEffect(() => {
        let active = true;
        let timer;
        let lastKey = '';
        const poll = async () => {
          if (document.visibilityState === 'hidden') {
            if (active) timer = setTimeout(poll, POLL_INTERVAL_MS);
            return;
          }
          try {
            const response = await fetch(PHOTO_ENDPOINT, { cache: 'no-store' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            const next = Array.isArray(data.photos)
              ? data.photos
                  .filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.url === 'string')
                  .map((entry) => ({ url: entry.url, name: typeof entry.name === 'string' ? entry.name : '' }))
              : [];
            const key = next.map((entry) => entry.url).join('|');
            if (active && key !== lastKey) {
              lastKey = key;
              setPhotos(next);
            }
          } catch {
            if (active) setPhotos((previous) => (previous === null ? [] : previous));
          } finally {
            if (active) timer = setTimeout(poll, POLL_INTERVAL_MS);
          }
        };
        poll();
        return () => {
          active = false;
          clearTimeout(timer);
        };
      }, []);
      return photos;
    }

    function userPhotoImage(url) {
      return h('g', { clipPath: 'url(#slClip)' },
        h('image', {
          href: url,
          x: -26,
          y: 11,
          width: 52,
          height: 52,
          preserveAspectRatio: 'xMidYMid slice',
        }),
      );
    }

    function Photo(props) {
      const { x, tilt, delay, duration, content, onOpen } = props;
      return h('g', {
        className: 'sl-photo',
        transform: 'translate(' + x + ' ' + ropeY(x).toFixed(2) + ')',
        onClick: onOpen,
      },
        h('g', { transform: 'rotate(' + tilt + ')' },
          h('g', { transform: 'scale(' + PHOTO_SCALE + ')' },
            h('g', {
              className: 'sl-sway',
              style: { animationDelay: delay, animationDuration: duration },
            },
              h('g', { className: 'sl-wobble' },
                peg(),
                frame(content),
              ),
            ),
          ),
        ),
      );
    }

    /** Full-screen viewer opened by clicking a photo; closes on Esc, backdrop or the close button. */
    function Lightbox(props) {
      const { preview, onClose } = props;
      if (preview === null) return null;
      const card = preview.kind === 'photo'
        ? h('div', { className: 'sl-lightbox-photo' },
            h('img', {
              src: preview.url,
              alt: preview.name || '照片',
              draggable: 'false',
            }))
        : h('div', { className: 'sl-lightbox-polaroid' },
            h('svg', {
              viewBox: '-31 6 62 80',
              role: 'img',
              'aria-label': '照片插画',
              focusable: 'false',
            },
              frame(preview.content)));
      const overlay = h('div', {
        className: 'sl-lightbox',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': '照片预览',
        onClick: (event) => {
          if (event.target === event.currentTarget) onClose();
        },
      },
        card,
        h('button', {
          type: 'button',
          className: 'sl-lightbox-close',
          'aria-label': '关闭预览',
          autoFocus: true,
          onClick: onClose,
        }, '×'),
      );
      return createPortal === null ? overlay : createPortal(overlay, document.body);
    }

    const DOCK_SVG_WIDTH = 700;
    /*
     * The dock entry sits in a fit-content flex row, so its `width: 100%` SVG
     * resolves to its intrinsic 300px; `max-width` alone never changes that.
     * The New Session hero therefore sets an explicit pixel width: twice that
     * 300px, clamped to the composer card measured by the hero watcher.
     */
    const HERO_SVG_WIDTH = 600;

    function Clothesline(props) {
      const source = props !== null && props !== undefined && props.source === 'hero' ? 'hero' : 'dock';
      const heroWidth = source === 'hero' && props !== null && props !== undefined
        && typeof props.width === 'number' && props.width > 0
        ? Math.round(props.width)
        : 0;
      const photos = usePhotoList();
      const [preview, setPreview] = React.useState(null);
      React.useEffect(() => {
        if (preview === null) return;
        const onKeyDown = (event) => {
          if (event.key !== 'Escape' && event.key !== 'Esc') return;
          event.stopPropagation();
          setPreview(null);
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
      }, [preview]);
      const usingOwnPhotos = Array.isArray(photos) && photos.length > 0;
      const items = usingOwnPhotos
        ? samplePhotos(photos, MAX_PHOTOS).map((photo) => ({ kind: 'photo', url: photo.url, name: photo.name }))
        : ILLUSTRATIONS.map((scene) => ({ kind: 'illustration', scene }));
      const xs = photoPositions(items.length);
      return h('div', {
        'aria-hidden': 'true',
        'data-dsh-snap-line': source,
        style: {
          display: 'flex',
          justifyContent: 'center',
          padding: '0 12px',
          pointerEvents: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        },
      },
        h('style', { key: 'css' }, CSS),
        h('svg', {
          key: 'art',
          viewBox: '0 0 700 108',
          role: 'presentation',
          focusable: 'false',
          width: '100%',
          style: {
            display: 'block',
            width: heroWidth > 0 ? heroWidth + 'px' : '100%',
            maxWidth: heroWidth > 0 ? 'none' : DOCK_SVG_WIDTH,
            height: 'auto',
            margin: '2px auto 0',
          },
        },
          defs,
          h('path', { d: 'M18 14 Q350 46 682 14', fill: 'none', stroke: '#9b8b72', strokeWidth: 3.2, strokeLinecap: 'round' }),
          h('path', { d: 'M18 14 Q350 46 682 14', fill: 'none', stroke: '#c9bca4', strokeWidth: 1, strokeLinecap: 'round', strokeDasharray: '1 4', opacity: 0.9 }),
          h('circle', { cx: 18, cy: 14, r: 2.6, fill: '#8a7a63' }),
          h('circle', { cx: 682, cy: 14, r: 2.6, fill: '#8a7a63' }),
          items.map((item, index) => {
            const content = item.kind === 'photo' ? userPhotoImage(item.url) : item.scene();
            return h(Photo, {
              key: item.kind === 'photo' ? 'photo-' + item.url : 'illustration-' + index,
              x: xs[index],
              tilt: TILTS[index % TILTS.length],
              delay: DELAYS[index % DELAYS.length],
              duration: DURATIONS[index % DURATIONS.length],
              content,
              onOpen: () => setPreview(
                item.kind === 'photo'
                  ? { kind: 'photo', url: item.url, name: item.name }
                  : { kind: 'illustration', content },
              ),
            });
          }),
        ),
        h(Lightbox, { key: 'lightbox', preview, onClose: () => setPreview(null) }),
      );
    }

    /*
     * The host only renders `conversation.composer.dock` once a Session is
     * active (the New Session hero shows an empty dock). While that hero is on
     * screen, hang the same clothesline from the frame-wide overlay layer and
     * portal it into the hero composer's always-rendered dock container, so the
     * home page looks like every other conversation.
     */
    const HERO_DOCK_SELECTOR = '[data-content-phase="hero"] [data-composer-dock]';
    const HERO_WATCH_INTERVAL_MS = 250;

    let createPortal = null;
    try {
      const reactDom = require('react-dom');
      if (reactDom !== null && reactDom !== undefined && typeof reactDom.createPortal === 'function') {
        createPortal = reactDom.createPortal;
      }
    } catch {
      createPortal = null;
    }

    /** The widest visible hero composer dock that has no in-flow clothesline yet, plus its card width. */
    function findHeroDock() {
      let target = null;
      let targetWidth = 0;
      for (const dock of document.querySelectorAll(HERO_DOCK_SELECTOR)) {
        if (dock.querySelector('[data-dsh-snap-line="dock"]') !== null) continue;
        const content = dock.closest('[data-content-phase="hero"]');
        const width = content === null ? dock.clientWidth : content.getBoundingClientRect().width;
        if (width <= 0) continue;
        if (target === null || width > targetWidth) {
          target = { dock, width: heroCardWidth(dock, width) };
          targetWidth = width;
        }
      }
      return target;
    }

    /** Width of the hero composer card, used to cap the enlarged hero artwork. */
    function heroCardWidth(dock, fallback) {
      const parent = dock.parentElement;
      const card = parent === null ? null : parent.querySelector('[data-composer-card]');
      if (card === null) return Math.max(0, fallback - 16);
      return card.getBoundingClientRect().width;
    }

    function sameHeroDock(left, right) {
      if (left === null || right === null) return left === right;
      return left.dock === right.dock && Math.abs(left.width - right.width) < 1;
    }

    function useHeroDock() {
      const [dock, setDock] = React.useState(null);
      React.useEffect(() => {
        const update = () => {
          if (document.visibilityState === 'hidden') return;
          const next = findHeroDock();
          setDock((current) => (sameHeroDock(current, next) ? current : next));
        };
        update();
        const timer = setInterval(update, HERO_WATCH_INTERVAL_MS);
        return () => clearInterval(timer);
      }, []);
      return dock;
    }

    /** Stays mounted in the shell overlay and paints into the hero composer. */
    function HeroClothesline() {
      const target = useHeroDock();
      if (createPortal === null || target === null) return null;
      const width = Math.min(HERO_SVG_WIDTH, Math.max(0, Math.round(target.width) - 24));
      return createPortal(h(Clothesline, { source: 'hero', width }), target.dock);
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'dsh-snap-line',
          order: 2,
        }, Clothesline));
        if (createPortal === null) return;
        try {
          ctx.slots.inject('shell.overlay', () => ctx.slots.register({
            name: 'shell.overlay',
            id: 'dsh-snap-line-hero',
            order: 0,
          }, HeroClothesline));
        } catch (error) {
          console.warn('dsh-snap-line: hero clothesline unavailable', error);
        }
      },
    };
  },
});
