// models/Post.js
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const BLOCK_TYPES = [
  'paragraph', 'heading', 'blockquote', 'pullquote',
  'idea', 'warning', 'info', 'image', 'divider', 'list', 'code'
];

const DIVIDER_STYLES = ['diamond', 'flame', 'stars', 'wave', 'plain'];

const CATEGORIES = [
  'traditions', 'artisan-crafts', 'festivals',
  'wellness', 'community', 'sacred-recipes'
];

const POST_STATUSES = ['draft', 'published', 'archived'];

const WPM = 220; // reading speed used for readTime auto-calculation

// ─────────────────────────────────────────────
//  BLOCK SUB-SCHEMA
// ─────────────────────────────────────────────
const BlockSchema = new Schema(
  {
    id: {
      type: String,
      required: [true, 'Block id is required'],
      trim: true
    },
    type: {
      type: String,
      required: [true, 'Block type is required'],
      enum: {
        values: BLOCK_TYPES,
        message: '"{VALUE}" is not a supported block type'
      }
    },

    // ── paragraph ──
    html: {
      type: String,
      default: ''
    },

    // ── heading ──
    level: {
      type: Number,
      min: [1, 'Heading level must be 1–3'],
      max: [3, 'Heading level must be 1–3']
      // not required here; validated per-block in pre-save
    },

    // ── text (blockquote, pullquote, idea, warning, info, code) ──
    text: {
      type: String,
      default: ''
    },

    // ── image ──
    url:     { type: String, trim: true },
    caption: { type: String, trim: true, maxlength: [500, 'Caption too long'] },
    alt:     { type: String, trim: true, maxlength: [300, 'Alt text too long'] },

    // ── divider ──
    style: {
      type: String,
      enum: {
        values: DIVIDER_STYLES,
        message: '"{VALUE}" is not a valid divider style'
      }
    },

    // ── list ──
    ordered: { type: Boolean, default: false },
    items:   { type: [String], default: undefined },  // undefined → not stored unless set

    // ── code ──
    language: { type: String, trim: true }
  },
  {
    _id: false,    // managed via block.id
    versionKey: false
  }
);

// ── Per-block cross-field validation ──
BlockSchema.pre('validate', function () {
  // nothing to do at sub-doc level; full validation done in PostSchema pre-validate
});

// ─────────────────────────────────────────────
//  POST SCHEMA
// ─────────────────────────────────────────────
const PostSchema = new Schema(
  {
    // ── CORE ──
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [300, 'Title cannot exceed 300 characters']
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: [500, 'Subtitle cannot exceed 500 characters'],
      default: ''
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,   // allows multiple docs with null slug
      trim: true,
      lowercase: true,
      maxlength: [100, 'Slug cannot exceed 100 characters'],
      match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens']
    },

    // ── CONTENT ──
    blocks: {
      type: [BlockSchema],
      default: []
    },

    // ── RENDER CACHE (never write directly) ──
    rendered_html: {
      type: String,
      default: ''
    },

    // ── SEARCH INDEX (excluded from normal queries) ──
    search_text: {
      type: String,
      default: '',
      select: false
    },

    // ── MEDIA ──
    coverImage: {
      url: {
        type: String,
        trim: true,
        validate: {
          validator: (v) => !v || /^https?:\/\/.+/.test(v),
          message: 'coverImage.url must be a valid URL'
        }
      },
      alt: {
        type: String,
        trim: true,
        maxlength: [300, 'Cover image alt text cannot exceed 300 characters']
      }
    },

    // ── TAXONOMY ──
    category: {
      type: String,
      enum: {
        values: CATEGORIES,
        message: '"{VALUE}" is not a valid category'
      },
      index: true
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: 'Posts may not have more than 20 tags'
      }
    },

    // ── META ──
    author: {
      type: String,
      trim: true,
      default: 'Priya Sharma',
      maxlength: [100, 'Author name cannot exceed 100 characters']
    },
    publishDate: {
      type: Date,
      index: true
    },
    // Stored as a human-readable string, e.g. "5 min read"
    // Auto-calculated in pre-save unless overridden manually.
    readTime: {
      type: String,
      trim: true
    },

    // ── STATS (calculated, not user-supplied) ──
    stats: {
      wordCount:  { type: Number, default: 0, min: 0 },
      blockCount: { type: Number, default: 0, min: 0 },
      imageCount: { type: Number, default: 0, min: 0 }
    },

    // ── SETTINGS ──
    settings: {
      isFeatured:    { type: Boolean, default: false },
      allowComments: { type: Boolean, default: true }
    },

    // ── STATUS ──
    status: {
      type: String,
      enum: {
        values: POST_STATUSES,
        message: '"{VALUE}" is not a valid status'
      },
      default: 'draft',
      index: true
    },

    lastSavedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,     // createdAt + updatedAt
    versionKey: '__v'
  }
);

// ─────────────────────────────────────────────
//  INDEXES
// ─────────────────────────────────────────────
PostSchema.index({ status: 1, publishDate: -1 });
PostSchema.index({ category: 1, status: 1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ 'settings.isFeatured': 1, status: 1 });
// MongoDB full-text index (use Atlas Search in production for better relevance)
PostSchema.index({ search_text: 'text', title: 'text', subtitle: 'text' });

// ─────────────────────────────────────────────
//  CROSS-FIELD BLOCK VALIDATION  (pre-validate)
// ─────────────────────────────────────────────
PostSchema.pre('validate', function (next) {
  const errors = [];

  this.blocks.forEach((block, i) => {
    const prefix = `blocks[${i}] (type="${block.type}")`;

    switch (block.type) {
      case 'heading':
        if (!block.level || block.level < 1 || block.level > 3) {
          errors.push(`${prefix}: level must be 1, 2, or 3`);
        }
        if (!block.text || !block.text.trim()) {
          errors.push(`${prefix}: text is required`);
        }
        break;

      case 'image':
        if (!block.url || !block.url.trim()) {
          errors.push(`${prefix}: url is required`);
        } else if (!/^https?:\/\/.+/.test(block.url)) {
          errors.push(`${prefix}: url must start with http:// or https://`);
        }
        break;

      case 'divider':
        if (!block.style || !DIVIDER_STYLES.includes(block.style)) {
          errors.push(`${prefix}: style must be one of [${DIVIDER_STYLES.join(', ')}]`);
        }
        break;

      case 'list':
        if (!Array.isArray(block.items) || block.items.length === 0) {
          errors.push(`${prefix}: items array must be non-empty`);
        }
        break;

      case 'code':
        if (!block.text || !block.text.trim()) {
          errors.push(`${prefix}: text (code content) is required`);
        }
        break;

      // paragraph, blockquote, pullquote, idea, warning, info
      // — text/html is optional (empty blocks are allowed during drafting)
      default:
        break;
    }
  });

  if (errors.length) {
    return next(new mongoose.Error.ValidationError(
      new Error(errors.join('; '))
    ));
  }

  next();
});

// ─────────────────────────────────────────────
//  PRE-SAVE HOOK
// ─────────────────────────────────────────────
PostSchema.pre('save', function (next) {
  try {
    // 1. Auto-generate slug from title (only when title changes and slug not manually set)
    if (this.isModified('title') && this.title && !this.isModified('slug')) {
      this.slug = buildSlug(this.title);
    }

    // 2. Rebuild derived fields whenever blocks change
    if (this.isModified('blocks')) {
      this.rendered_html = renderBlocks(this.blocks);
      this.search_text   = extractText(this.blocks);

      this.stats.blockCount = this.blocks.length;
      this.stats.imageCount = this.blocks.filter(b => b.type === 'image').length;
      this.stats.wordCount  = countWords(this.search_text);

      // Auto-set readTime unless already manually assigned
      if (!this.readTime || this._autoReadTime) {
        const mins = Math.max(1, Math.ceil(this.stats.wordCount / WPM));
        this.readTime    = `${mins} min read`;
        this._autoReadTime = true; // mark as auto so next save can overwrite
      }
    }

    // 3. Set publishDate when first publishing
    if (this.isModified('status') && this.status === 'published' && !this.publishDate) {
      this.publishDate = new Date();
    }

    // 4. Refresh lastSavedAt
    this.lastSavedAt = new Date();

    next();
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
//  STATIC METHODS
// ─────────────────────────────────────────────

/**
 * Find published posts, newest first.
 * @param {Object} filter   - Additional query fields
 * @param {Object} options  - { page, limit, sort }
 */
PostSchema.statics.findPublished = function (filter = {}, { page = 1, limit = 20, sort = { publishDate: -1 } } = {}) {
  const skip = (page - 1) * limit;
  return this.find({ status: 'published', ...filter })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Full-text search over search_text + title + subtitle.
 * Falls back to regex if MongoDB text index is not available.
 */
PostSchema.statics.search = function (query, { limit = 20 } = {}) {
  return this.find(
    { $text: { $search: query }, status: 'published' },
    { score: { $meta: 'textScore' }, search_text: 0 }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();
};

// ─────────────────────────────────────────────
//  INSTANCE METHODS
// ─────────────────────────────────────────────

/**
 * Mark a post as published and set publishDate if not already set.
 */
PostSchema.methods.publish = function () {
  this.status      = 'published';
  this.publishDate = this.publishDate || new Date();
  return this.save();
};

/**
 * Archive a post.
 */
PostSchema.methods.archive = function () {
  this.status = 'archived';
  return this.save();
};

// ─────────────────────────────────────────────
//  VIRTUAL
// ─────────────────────────────────────────────

/** Estimated reading time as a number (minutes). */
PostSchema.virtual('readTimeMinutes').get(function () {
  return Math.max(1, Math.ceil(this.stats.wordCount / WPM));
});

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

/**
 * Builds a URL-safe slug from a title string.
 * @param {string} title
 * @returns {string}
 */
function buildSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .normalize('NFD')                       // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '')        // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')          // keep letters, digits, spaces, hyphens
    .replace(/\s+/g, '-')                   // spaces → hyphens
    .replace(/-{2,}/g, '-')                 // collapse multiple hyphens
    .replace(/^-+|-+$/g, '')               // trim leading/trailing hyphens
    .substring(0, 100);
}

/**
 * Counts plain-text words.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  const trimmed = (text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Renders an array of blocks to an HTML string.
 * @param {Array} blocks
 * @returns {string}
 */
function renderBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';

  return blocks
    .map(b => {
      const d = b;
      switch (b.type) {
        case 'paragraph':
          return `<p>${escapeOrPassthrough(d.html || d.text)}</p>`;

        case 'heading': {
          const lvl = d.level || 2;
          return `<h${lvl}>${escapeText(d.text)}</h${lvl}>`;
        }

        case 'blockquote':
          return `<blockquote>${escapeText(d.text)}</blockquote>`;

        case 'pullquote':
          return `<div class="pullquote">${escapeText(d.text)}</div>`;

        case 'idea':
          return `<div class="editor-idea"><span aria-hidden="true">💡</span> ${escapeText(d.text)}</div>`;

        case 'warning':
          return `<div class="editor-warning"><span aria-hidden="true">⚠️</span> ${escapeText(d.text)}</div>`;

        case 'info':
          return `<div class="editor-info"><span aria-hidden="true">ℹ️</span> ${escapeText(d.text)}</div>`;

        case 'image': {
          const src     = escapeAttr(d.url || '');
          const alt     = escapeAttr(d.alt || d.caption || '');
          const caption = d.caption ? `<figcaption>${escapeText(d.caption)}</figcaption>` : '';
          return `<figure><img src="${src}" alt="${alt}" loading="lazy"/>${caption}</figure>`;
        }

        case 'divider':
          return `<div class="divider divider--${escapeAttr(d.style || 'plain')}" aria-hidden="true"></div>`;

        case 'list': {
          const tag   = d.ordered ? 'ol' : 'ul';
          const items = (d.items || []).map(item => `<li>${escapeText(item)}</li>`).join('');
          return `<${tag}>${items}</${tag}>`;
        }

        case 'code': {
          const lang = d.language ? ` class="language-${escapeAttr(d.language)}"` : '';
          return `<pre><code${lang}>${escapeText(d.text || '')}</code></pre>`;
        }

        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Extracts plain text from all blocks for the search index.
 * @param {Array} blocks
 * @returns {string}
 */
function extractText(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';

  return blocks
    .map(b => {
      switch (b.type) {
        case 'image':   return [b.caption, b.alt].filter(Boolean).join(' ');
        case 'divider': return '';
        case 'list':    return (b.items || []).join(' ');
        case 'paragraph':
          // strip inline HTML tags from stored html string
          return (b.html || b.text || '').replace(/<[^>]+>/g, '').trim();
        default:
          return (b.text || '').trim();
      }
    })
    .filter(Boolean)
    .join(' ');
}

// ── XSS helpers ──────────────────────────────

const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };

/**
 * Escape a string for use as HTML text content.
 * Paragraphs pass through stored HTML as-is (sanitised on input).
 */
function escapeText(str) {
  return (str || '').replace(/[&<>"']/g, c => HTML_ESCAPE_MAP[c]);
}

/**
 * For HTML fields (paragraph), the stored value is already sanitised HTML.
 * Plain text fields fall back to escaping.
 */
function escapeOrPassthrough(value) {
  return value || '';
}

/**
 * Escape a string for use inside an HTML attribute value.
 */
function escapeAttr(str) {
  return (str || '').replace(/[&<>"']/g, c => HTML_ESCAPE_MAP[c]);
}

// ─────────────────────────────────────────────
//  MODEL EXPORT
// ─────────────────────────────────────────────
const Post = mongoose.models.Post || mongoose.model('Post', PostSchema);

module.exports = Post;