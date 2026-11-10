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
        cursor: pointer;
      }
      .sl-photo:focus {
        outline: none;
      }
      .sl-photo:focus-visible {
        outline: 2px solid #a98d63;
        outline-offset: 2px;
        border-radius: 4px;
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
      .sl-lightbox-close:focus {
        outline: none;
      }
      .sl-lightbox-close:focus-visible {
        outline: 2px solid #f0e2c4;
        outline-offset: 2px;
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
    const PHOTO_ENDPOINT = '/dsh-snap-line/photos.json';
    const MANAGE_ENDPOINT = '/dsh-snap-line/manage';
    const PHOTOS_CHANGED_EVENT = 'dsh-snap-line:photos-changed';
    const POLL_INTERVAL_MS = 5000;
    const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

    /** Evenly spread photo centers along the rope, capped at the old five-photo spacing. */
    function photoPositions(count) {
      if (count <= 1) return [350];
      const spacing = Math.min(116, 464 / (count - 1));
      const first = 350 - (spacing * (count - 1)) / 2;
      return Array.from({ length: count }, (_, index) => Math.round((first + spacing * index) * 100) / 100);
    }

    /**
     * Poll the host's photo listing and refresh at once when the photo manager
     * dispatches PHOTOS_CHANGED_EVENT after a write; the poll stays as fallback
     * for photos dropped into the folder by hand.
     */
    function useManifest(onRopeOnly) {
      const [photos, setPhotos] = React.useState(null);
      React.useEffect(() => {
        let active = true;
        let timer = null;
        let running = false;
        let pending = false;
        let lastKey = '';
        const load = async () => {
          if (document.visibilityState === 'hidden') return;
          try {
            const response = await fetch(PHOTO_ENDPOINT, { cache: 'no-store' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            /* The Host decides which photos are on the rope; the Client only renders them. */
            const next = Array.isArray(data.photos)
              ? data.photos
                  .filter((entry) => entry !== null && typeof entry === 'object'
                    && (onRopeOnly === false || entry.onRope === true)
                    && typeof entry.displayUrl === 'string'
                    && typeof entry.originalUrl === 'string')
                  .map((entry) => ({
                    name: typeof entry.name === 'string' ? entry.name : '',
                    displayUrl: entry.displayUrl,
                    originalUrl: entry.originalUrl,
                    onRope: entry.onRope === true,
                  }))
              : [];
            const key = next
              .map((entry) => entry.name + '|' + entry.onRope + '|' + entry.displayUrl + '|' + entry.originalUrl)
              .join('|');
            if (active && key !== lastKey) {
              lastKey = key;
              setPhotos(next);
            }
          } catch {
            if (active) setPhotos((previous) => (previous === null ? [] : previous));
          }
        };
        const run = async () => {
          timer = null;
          if (running) {
            pending = true;
            return;
          }
          running = true;
          await load();
          running = false;
          if (!active) return;
          if (pending) {
            pending = false;
            void run();
          } else {
            timer = setTimeout(run, POLL_INTERVAL_MS);
          }
        };
        const refresh = () => {
          if (!active) return;
          clearTimeout(timer);
          void run();
        };
        void run();
        window.addEventListener(PHOTOS_CHANGED_EVENT, refresh);
        return () => {
          active = false;
          clearTimeout(timer);
          window.removeEventListener(PHOTOS_CHANGED_EVENT, refresh);
        };
      }, [onRopeOnly]);
      return photos;
    }

    function usePhotoList() {
      return useManifest(true);
    }

    /* --- Photo manager --------------------------------------------------- */

    const MANAGER_NAMESPACE = 'snapLineManager';
    const MANAGER_DICTIONARY = {
      zh: {
        title: '照片',
        summary: '共 {total} 张，{onRope} 张在绳上',
        loading: '正在读取照片…',
        empty: '照片目录还是空的；添加照片后就会替换内置插画。',
        add: '添加照片',
        uploading: '正在添加…',
        dropZone: '添加照片区域',
        dropHint: '把照片拖到这里，或选择文件；支持 JPG、PNG、WebP、GIF、AVIF，单张不超过 25MB。',
        photoList: '照片列表',
        photoItem: '照片 {position}：{name}',
        reorderHint: '拖动缩略图，或用每一张的上移/下移按钮调整顺序；排在前六张的照片在绳上。',
        moveUp: '上移',
        moveDown: '下移',
        moveUpPhoto: '上移照片 {position}：{name}',
        moveDownPhoto: '下移照片 {position}：{name}',
        reordering: '正在保存顺序…',
        orderSaved: '顺序已更新。',
        errorOrder: '顺序保存失败，请稍后重试。',
        errorOrderForbidden: '顺序保存被拒绝，请刷新页面后重试。',
        errorOrderInvalid: '顺序请求无效，请刷新页面后重试。',
        onRope: '在绳上',
        offRope: '未上绳',
        added: '已添加 {count} 张照片。',
        delete: '删除',
        deletePhoto: '删除照片：{name}',
        deletePrompt: '确定删除？',
        deleteConfirm: '删除确认：{name}',
        confirmDelete: '确认删除',
        confirmDeletePhoto: '确认删除照片：{name}',
        cancelDelete: '取消',
        cancelDeletePhoto: '取消删除照片：{name}',
        deleting: '正在删除…',
        deleted: '已删除 {name}。',
        errorDeleteMissing: '{name}：照片已不存在，未删除。',
        errorDeleteFailed: '{name}：删除失败，请稍后重试。',
        errorInvalidName: '{name}：文件名不能包含路径分隔符、以点开头或过长，未添加。',
        errorUnsupported: '{name}：不支持的图片格式，未添加。',
        errorHeic: '{name}：暂不支持 HEIC，请先转换为 JPG 或 PNG。',
        errorTooLarge: '{name}：超过单张 25MB 或 6400 万像素，未添加。',
        errorInvalidImage: '{name}：文件内容与图片格式不符，未添加。',
        errorForbidden: '{name}：请求被拒绝，请刷新页面后重试。',
        errorUnexpected: '{name}：添加失败，请稍后重试。',
      },
      en: {
        title: 'Photos',
        summary: '{total} photos · {onRope} on the rope',
        loading: 'Reading photos…',
        empty: 'The photo folder is still empty; add photos to replace the built-in illustrations.',
        add: 'Add photos',
        uploading: 'Adding…',
        dropZone: 'Add photos area',
        dropHint: 'Drop photos here or choose files; JPG, PNG, WebP, GIF and AVIF, up to 25MB each.',
        photoList: 'Photo list',
        photoItem: 'Photo {position}: {name}',
        reorderHint: 'Drag thumbnails, or use each photo\'s Move up / Move down buttons; the first six photos hang on the rope.',
        moveUp: 'Move up',
        moveDown: 'Move down',
        moveUpPhoto: 'Move photo {position} up: {name}',
        moveDownPhoto: 'Move photo {position} down: {name}',
        reordering: 'Saving the order…',
        orderSaved: 'Order updated.',
        errorOrder: 'Could not save the order; try again later.',
        errorOrderForbidden: 'The order write was refused; refresh the page and try again.',
        errorOrderInvalid: 'The order request was invalid; refresh the page and try again.',
        onRope: 'On the rope',
        offRope: 'Off the rope',
        added: 'Added {count} photos.',
        delete: 'Delete',
        deletePhoto: 'Delete photo: {name}',
        deletePrompt: 'Delete this photo?',
        deleteConfirm: 'Delete confirmation: {name}',
        confirmDelete: 'Confirm delete',
        confirmDeletePhoto: 'Confirm deleting photo: {name}',
        cancelDelete: 'Cancel',
        cancelDeletePhoto: 'Cancel deleting photo: {name}',
        deleting: 'Deleting…',
        deleted: 'Deleted {name}.',
        errorDeleteMissing: '{name}: the photo is already gone; nothing was deleted.',
        errorDeleteFailed: '{name}: could not delete the photo; try again later.',
        errorInvalidName: '{name}: the file name cannot contain path separators, start with a dot, or be too long; not added.',
        errorUnsupported: '{name}: unsupported image type; not added.',
        errorHeic: '{name}: HEIC is not supported yet; convert it to JPG or PNG first.',
        errorTooLarge: '{name}: larger than 25MB or 64 megapixels; not added.',
        errorInvalidImage: '{name}: the file contents do not match an image; not added.',
        errorForbidden: '{name}: the request was refused; refresh the page and try again.',
        errorUnexpected: '{name}: could not add the photo; try again later.',
      },
    };

    const MANAGER_CSS = `
      .sl-manager {
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-size: 13px;
        line-height: 1.5;
        color: inherit;
      }
      .sl-manager-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .sl-manager-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }
      .sl-manager-summary {
        opacity: 0.7;
      }
      .sl-manager-drop {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        padding: 12px 14px;
        border: 1px dashed rgba(128, 128, 128, 0.55);
        border-radius: 8px;
        transition: background-color 120ms ease, border-color 120ms ease;
      }
      .sl-manager-drop[data-dragging="true"] {
        border-color: rgba(128, 128, 128, 0.95);
        background: rgba(128, 128, 128, 0.12);
      }
      .sl-manager-hint {
        margin: 0;
        opacity: 0.78;
        flex: 1 1 220px;
      }
      .sl-manager-reorder-hint {
        margin: 0;
        opacity: 0.78;
      }
      .sl-manager-button {
        padding: 6px 12px;
        border: 1px solid rgba(128, 128, 128, 0.5);
        border-radius: 6px;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .sl-manager-button:hover:not(:disabled) {
        background: rgba(128, 128, 128, 0.12);
      }
      .sl-manager-button:focus-visible {
        outline: 2px solid rgba(128, 128, 128, 0.9);
        outline-offset: 2px;
      }
      .sl-manager-button:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .sl-manager-input {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        border: 0;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      .sl-manager-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
        gap: 12px;
      }
      .sl-manager-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .sl-manager-item[draggable="true"] {
        cursor: grab;
      }
      .sl-manager-item-dragging {
        opacity: 0.55;
      }
      .sl-manager-item-over {
        outline: 2px dashed rgba(128, 128, 128, 0.9);
        outline-offset: 3px;
        border-radius: 8px;
      }
      .sl-manager-move {
        flex: 1 1 0;
        padding: 1px 0;
        border: 1px solid rgba(128, 128, 128, 0.5);
        border-radius: 6px;
        background: transparent;
        color: inherit;
        font: inherit;
        line-height: 1.4;
        cursor: pointer;
      }
      .sl-manager-move:hover:not(:disabled) {
        background: rgba(128, 128, 128, 0.12);
      }
      .sl-manager-move:focus-visible {
        outline: 2px solid rgba(128, 128, 128, 0.9);
        outline-offset: 2px;
      }
      .sl-manager-move:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .sl-manager-error {
        margin: 0;
        color: #c0392b;
      }
      .sl-manager-thumb {
        display: block;
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        border-radius: 6px;
        background: rgba(128, 128, 128, 0.12);
      }
      .sl-manager-name {
        overflow-wrap: anywhere;
      }
      .sl-manager-badge {
        align-self: flex-start;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 11px;
        background: rgba(128, 128, 128, 0.18);
      }
      .sl-manager-badge-off {
        opacity: 0.6;
      }
      .sl-manager-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
      }
      .sl-manager-confirm-text {
        font-size: 12px;
        opacity: 0.85;
      }
      .sl-manager-delete {
        color: #c0392b;
        border-color: rgba(192, 57, 43, 0.45);
      }
      .sl-manager-delete:hover:not(:disabled) {
        background: rgba(192, 57, 43, 0.12);
      }
      .sl-manager-delete:focus-visible {
        outline: 2px solid rgba(192, 57, 43, 0.8);
        outline-offset: 2px;
      }
      .sl-manager-errors {
        margin: 0;
        padding-left: 18px;
        color: #c0392b;
      }
      .sl-manager-notice {
        margin: 0;
        opacity: 0.8;
      }
      @media (prefers-reduced-motion: reduce) {
        .sl-manager-drop {
          transition: none;
        }
      }
    `;

    const UPLOAD_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);
    const HEIC_EXTENSIONS = new Set(['heic', 'heif']);
    const MEDIA_TYPES_BY_EXTENSION = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      avif: 'image/avif',
    };
    const MANAGER_ERROR_KEYS = {
      'invalid-name': 'errorInvalidName',
      'unsupported-media-type': 'errorUnsupported',
      heic: 'errorHeic',
      'too-large': 'errorTooLarge',
      'too-many-pixels': 'errorTooLarge',
      'magic-mismatch': 'errorInvalidImage',
      forbidden: 'errorForbidden',
      'unknown-action': 'errorUnexpected',
      'method-not-allowed': 'errorUnexpected',
    };

    function fileNameExtension(name) {
      const dot = name.lastIndexOf('.');
      return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
    }

    async function uploadPhoto(file, t) {
      const extension = fileNameExtension(file.name);
      if (HEIC_EXTENSIONS.has(extension)) return { error: t('errorHeic', { name: file.name }) };
      if (!UPLOAD_EXTENSIONS.has(extension)) return { error: t('errorUnsupported', { name: file.name }) };
      if (file.size > MAX_UPLOAD_BYTES) return { error: t('errorTooLarge', { name: file.name }) };
      const contentType = typeof file.type === 'string' && file.type.length > 0
        ? file.type
        : MEDIA_TYPES_BY_EXTENSION[extension];
      let payload = null;
      try {
        const response = await fetch(
          MANAGE_ENDPOINT + '?action=add&name=' + encodeURIComponent(file.name),
          {
            method: 'POST',
            headers: { 'content-type': contentType },
            body: file,
          },
        );
        payload = await response.json().catch(() => null);
        if (!response.ok) {
          const code = payload !== null && typeof payload.error === 'string' ? payload.error : '';
          return { error: t(MANAGER_ERROR_KEYS[code] || 'errorUnexpected', { name: file.name }) };
        }
      } catch {
        return { error: t('errorUnexpected', { name: file.name }) };
      }
      return { name: payload !== null && typeof payload.name === 'string' ? payload.name : file.name };
    }

    const ORDER_ERROR_KEYS = {
      forbidden: 'errorOrderForbidden',
      'invalid-order': 'errorOrderInvalid',
      'invalid-name': 'errorOrderInvalid',
      'too-large': 'errorOrderInvalid',
      'unsupported-media-type': 'errorOrderInvalid',
    };

    /** Write the full name array; the Host normalizes it and the manifest follows. */
    async function saveOrder(names, t) {
      try {
        const response = await fetch(MANAGE_ENDPOINT + '?action=order', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ names }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const code = payload !== null && typeof payload.error === 'string' ? payload.error : '';
          return { error: t(ORDER_ERROR_KEYS[code] || 'errorOrder') };
        }
      } catch {
        return { error: t('errorOrder') };
      }
      return { ok: true };
    }

    function PhotoManager(props) {
      const { t } = props;
      const photos = useManifest(false);
      const [errors, setErrors] = React.useState([]);
      const [notice, setNotice] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [dragging, setDragging] = React.useState(false);
      const [ordering, setOrdering] = React.useState(false);
      const [orderError, setOrderError] = React.useState('');
      const [dragIndex, setDragIndex] = React.useState(null);
      const [dropIndex, setDropIndex] = React.useState(null);
      const [confirming, setConfirming] = React.useState('');
      const [deleting, setDeleting] = React.useState('');
      const inputRef = React.useRef(null);
      const deleteButtonRefs = React.useRef({});
      const confirmButtonRef = React.useRef(null);
      const restoreFocusTo = React.useRef('');

      /* Move focus into the confirm step, and back to the delete control when it closes. */
      React.useEffect(() => {
        if (confirming !== '') {
          if (confirmButtonRef.current !== null) confirmButtonRef.current.focus();
          return;
        }
        const name = restoreFocusTo.current;
        if (name === '') return;
        restoreFocusTo.current = '';
        const button = deleteButtonRefs.current[name];
        if (button !== undefined && button !== null) button.focus();
      }, [confirming]);

      const addFiles = async (fileList) => {
        const files = Array.from(fileList || []);
        if (files.length === 0) return;
        setBusy(true);
        setErrors([]);
        setOrderError('');
        setNotice('');
        const failures = [];
        let added = 0;
        for (const file of files) {
          const result = await uploadPhoto(file, t);
          if (result.error !== undefined) failures.push(result.error);
          else added += 1;
        }
        setBusy(false);
        setErrors(failures);
        if (added > 0) {
          setNotice(t('added', { count: added }));
          window.dispatchEvent(new Event(PHOTOS_CHANGED_EVENT));
        }
      };

      const removePhoto = async (name) => {
        setDeleting(name);
        setErrors([]);
        setOrderError('');
        setNotice('');
        let failed = false;
        try {
          const response = await fetch(MANAGE_ENDPOINT + '?action=delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            failed = true;
            const code = payload !== null && typeof payload.error === 'string' ? payload.error : '';
            const key = code === 'not-found'
              ? 'errorDeleteMissing'
              : code === 'forbidden' ? 'errorForbidden' : 'errorDeleteFailed';
            setErrors([t(key, { name })]);
            return;
          }
          setNotice(t('deleted', { name }));
          window.dispatchEvent(new Event(PHOTOS_CHANGED_EVENT));
        } catch {
          failed = true;
          setErrors([t('errorDeleteFailed', { name })]);
        } finally {
          setDeleting('');
          setConfirming('');
          if (failed) restoreFocusTo.current = name;
        }
      };

      const cancelDelete = (name) => {
        restoreFocusTo.current = name;
        setConfirming('');
      };

      const onDrop = (event) => {
        event.preventDefault();
        setDragging(false);
        void addFiles(event.dataTransfer === null ? null : event.dataTransfer.files);
      };
      const onDragOver = (event) => {
        event.preventDefault();
        if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy';
        setDragging(true);
      };

      const persistOrder = async (ordered) => {
        setOrdering(true);
        setOrderError('');
        setNotice(t('reordering'));
        const result = await saveOrder(ordered.map((photo) => photo.name), t);
        setOrdering(false);
        if (result.error !== undefined) {
          setNotice('');
          setOrderError(result.error);
          return;
        }
        setNotice(t('orderSaved'));
        window.dispatchEvent(new Event(PHOTOS_CHANGED_EVENT));
      };

      /** Splice the dragged photo to the drop position, then persist the whole order. */
      const movePhoto = (from, to) => {
        if (photos === null || busy || ordering || deleting !== '') return;
        if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return;
        const next = photos.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        void persistOrder(next);
      };

      const startDrag = (event, index) => {
        if (busy || ordering || deleting !== '') {
          event.preventDefault();
          return;
        }
        setDragIndex(index);
        setDropIndex(index);
        if (event.dataTransfer !== null) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', photos === null ? '' : photos[index].name);
        }
      };
      const dragOverItem = (event, index) => {
        if (dragIndex === null) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
        setDropIndex(index);
      };
      const dropOnItem = (event, index) => {
        if (dragIndex === null) return;
        event.preventDefault();
        event.stopPropagation();
        const from = dragIndex;
        setDragIndex(null);
        setDropIndex(null);
        movePhoto(from, index);
      };
      const endDrag = () => {
        setDragIndex(null);
        setDropIndex(null);
      };

      const total = photos === null ? 0 : photos.length;
      const onRope = photos === null ? 0 : photos.filter((photo) => photo.onRope).length;
      const locked = busy || ordering || deleting !== '';
      return h('section', { className: 'sl-manager', 'aria-label': t('title') },
        h('style', { key: 'css' }, MANAGER_CSS),
        h('div', { className: 'sl-manager-header' },
          h('h3', { className: 'sl-manager-title' }, t('title')),
          photos === null ? null : h('span', { className: 'sl-manager-summary' }, t('summary', { total, onRope })),
        ),
        h('div', {
          className: 'sl-manager-drop',
          'data-dragging': dragging ? 'true' : 'false',
          role: 'group',
          'aria-label': t('dropZone'),
          onDragOver,
          onDragLeave: () => setDragging(false),
          onDrop,
        },
          h('span', { className: 'sl-manager-hint' }, t('dropHint')),
          h('button', {
            type: 'button',
            className: 'sl-manager-button',
            disabled: locked,
            'aria-busy': busy ? 'true' : 'false',
            onClick: () => {
              if (inputRef.current !== null) inputRef.current.click();
            },
          }, busy ? t('uploading') : t('add')),
          h('input', {
            ref: inputRef,
            type: 'file',
            className: 'sl-manager-input',
            accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif',
            multiple: true,
            tabIndex: -1,
            disabled: locked,
            'aria-hidden': 'true',
            onChange: (event) => {
              const files = event.target.files;
              event.target.value = '';
              void addFiles(files);
            },
          }),
        ),
        errors.length === 0 ? null : h('ul', { className: 'sl-manager-errors', role: 'alert' },
          errors.map((message, index) => h('li', { key: index }, message))),
        orderError === '' ? null : h('p', { className: 'sl-manager-error', role: 'alert' }, orderError),
        notice === '' ? null : h('p', { className: 'sl-manager-notice', role: 'status', 'aria-live': 'polite' }, notice),
        photos !== null && photos.length > 1
          ? h('p', { className: 'sl-manager-reorder-hint' }, t('reorderHint'))
          : null,
        photos === null
          ? h('p', { className: 'sl-manager-hint' }, t('loading'))
          : photos.length === 0
            ? h('p', { className: 'sl-manager-hint' }, t('empty'))
            : h('ul', {
                className: 'sl-manager-list',
                'aria-label': t('photoList'),
                'aria-busy': ordering ? 'true' : 'false',
              },
                photos.map((photo, index) => {
                  const isDeleting = deleting === photo.name;
                  return h('li', {
                    key: photo.name,
                    className: 'sl-manager-item'
                      + (dragIndex === index ? ' sl-manager-item-dragging' : '')
                      + (dropIndex === index && dragIndex !== null ? ' sl-manager-item-over' : ''),
                    'aria-label': t('photoItem', { position: index + 1, name: photo.name }),
                    draggable: !locked,
                    onDragStart: (event) => startDrag(event, index),
                    onDragOver: (event) => dragOverItem(event, index),
                    onDrop: (event) => dropOnItem(event, index),
                    onDragEnd: endDrag,
                  },
                    h('img', {
                      className: 'sl-manager-thumb',
                      src: photo.displayUrl,
                      alt: '',
                      draggable: 'false',
                    }),
                    h('span', { className: 'sl-manager-name' }, photo.name),
                    h('span', {
                      className: photo.onRope
                        ? 'sl-manager-badge'
                        : 'sl-manager-badge sl-manager-badge-off',
                    }, photo.onRope ? t('onRope') : t('offRope')),
                    confirming === photo.name
                      ? h('div', {
                          className: 'sl-manager-actions',
                          role: 'group',
                          'aria-label': t('deleteConfirm', { name: photo.name }),
                          onKeyDown: (event) => {
                            if (event.key !== 'Escape') return;
                            event.preventDefault();
                            cancelDelete(photo.name);
                          },
                        },
                          h('span', { className: 'sl-manager-confirm-text' }, t('deletePrompt')),
                          h('button', {
                            ref: confirmButtonRef,
                            type: 'button',
                            className: 'sl-manager-button sl-manager-delete',
                            'aria-label': t('confirmDeletePhoto', { name: photo.name }),
                            disabled: isDeleting,
                            'aria-busy': isDeleting ? 'true' : 'false',
                            onClick: () => {
                              void removePhoto(photo.name);
                            },
                          }, isDeleting ? t('deleting') : t('confirmDelete')),
                          h('button', {
                            type: 'button',
                            className: 'sl-manager-button',
                            'aria-label': t('cancelDeletePhoto', { name: photo.name }),
                            disabled: isDeleting,
                            onClick: () => cancelDelete(photo.name),
                          }, t('cancelDelete')),
                        )
                      : h('div', { className: 'sl-manager-actions' },
                          h('button', {
                            ref: (element) => {
                              deleteButtonRefs.current[photo.name] = element;
                            },
                            type: 'button',
                            className: 'sl-manager-button sl-manager-delete',
                            'aria-label': t('deletePhoto', { name: photo.name }),
                            disabled: locked,
                            onClick: () => {
                              setErrors([]);
                              setOrderError('');
                              setNotice('');
                              setConfirming(photo.name);
                            },
                          }, t('delete')),
                        ),
                    h('div', { className: 'sl-manager-actions' },
                      h('button', {
                        type: 'button',
                        className: 'sl-manager-move',
                        disabled: locked || index === 0,
                        'aria-label': t('moveUpPhoto', { position: index + 1, name: photo.name }),
                        title: t('moveUp'),
                        onClick: () => movePhoto(index, index - 1),
                      }, '↑'),
                      h('button', {
                        type: 'button',
                        className: 'sl-manager-move',
                        disabled: locked || index === photos.length - 1,
                        'aria-label': t('moveDownPhoto', { position: index + 1, name: photo.name }),
                        title: t('moveDown'),
                        onClick: () => movePhoto(index, index + 1),
                      }, '↓'),
                    ),
                  );
                })),
      );
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
      const { x, tilt, delay, duration, content, onOpen, label } = props;
      const onKeyDown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
        event.preventDefault();
        onOpen();
      };
      return h('g', {
        className: 'sl-photo',
        transform: 'translate(' + x + ' ' + ropeY(x).toFixed(2) + ')',
        role: 'button',
        tabIndex: 0,
        'aria-label': label,
        onClick: onOpen,
        onKeyDown,
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
      const closeRef = React.useRef(null);
      React.useEffect(() => {
        if (preview === null) return;
        const previous = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        if (closeRef.current !== null) closeRef.current.focus();
        return () => {
          document.body.style.overflow = previousOverflow;
          if (previous !== null && typeof previous.focus === 'function') previous.focus();
        };
      }, [preview]);
      if (preview === null) return null;
      const label = preview.kind === 'photo'
        ? preview.name || '照片 / Photo'
        : '照片插画 / Photo illustration';
      const card = preview.kind === 'photo'
        ? h('div', { className: 'sl-lightbox-photo' },
            h('img', {
              src: preview.url,
              alt: label,
              draggable: 'false',
            }))
        : h('div', { className: 'sl-lightbox-polaroid' },
            h('svg', {
              viewBox: '-31 6 62 80',
              role: 'img',
              'aria-label': label,
              focusable: 'false',
            },
              frame(preview.content)));
      const overlay = h('div', {
        className: 'sl-lightbox',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': '照片预览 / Photo preview',
        onKeyDown: (event) => {
          if (event.key !== 'Tab') return;
          event.preventDefault();
          if (closeRef.current !== null) closeRef.current.focus();
        },
        onClick: (event) => {
          if (event.target === event.currentTarget) onClose();
        },
      },
        card,
        h('button', {
          type: 'button',
          className: 'sl-lightbox-close',
          'aria-label': '关闭预览 / Close preview',
          ref: closeRef,
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
        ? photos.map((photo) => ({
            kind: 'photo',
            displayUrl: photo.displayUrl,
            originalUrl: photo.originalUrl,
            name: photo.name,
          }))
        : ILLUSTRATIONS.map((scene) => ({ kind: 'illustration', scene }));
      const xs = photoPositions(items.length);
      return h('div', {
        role: 'group',
        'aria-label': '照片晾衣绳 / Photo clothesline',
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
          role: 'group',
          'aria-label': '照片 / Photos',
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
            const content = item.kind === 'photo' ? userPhotoImage(item.displayUrl) : item.scene();
            return h(Photo, {
              key: item.kind === 'photo' ? 'photo-' + item.name : 'illustration-' + index,
              x: xs[index],
              tilt: TILTS[index % TILTS.length],
              delay: DELAYS[index % DELAYS.length],
              duration: DURATIONS[index % DURATIONS.length],
              content,
              label: item.kind === 'photo'
                ? '照片 ' + (index + 1) + (item.name === '' ? '' : '：' + item.name) + ' / Photo ' + (index + 1)
                : '内置插画 ' + (index + 1) + ' / Built-in illustration ' + (index + 1),
              onOpen: () => setPreview(
                item.kind === 'photo'
                  ? { kind: 'photo', url: item.originalUrl, name: item.name }
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
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(MANAGER_NAMESPACE, MANAGER_DICTIONARY),
          'dsh-snap-line: photo manager copy',
        );
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: 'dsh-snap-line',
          locale: MANAGER_NAMESPACE,
        }, PhotoManager));
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
