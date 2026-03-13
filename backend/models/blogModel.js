// models/blogModel.js
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
const REACTION_TYPES = ['read', 'love'];
const WPM = 220;

// ─────────────────────────────────────────────
//  BLOCK SUB-SCHEMA
// ─────────────────────────────────────────────
const BlockSchema = new Schema(
  {
    id:       { type: String, required: [true, 'Block id is required'], trim: true },
    type:     { type: String, required: [true, 'Block type is required'], enum: { values: BLOCK_TYPES, message: '"{VALUE}" is not a supported block type' } },
    html:     { type: String, default: '' },
    level:    { type: Number, min: [1, 'Heading level must be 1–3'], max: [3, 'Heading level must be 1–3'] },
    text:     { type: String, default: '' },
    url:      { type: String, trim: true },
    caption:  { type: String, trim: true, maxlength: [500, 'Caption too long'] },
    alt:      { type: String, trim: true, maxlength: [300, 'Alt text too long'] },
    style:    { type: String, enum: { values: DIVIDER_STYLES, message: '"{VALUE}" is not a valid divider style' } },
    ordered:  { type: Boolean, default: false },
    items:    { type: [String], default: undefined },
    language: { type: String, trim: true }
  },
  { _id: false, versionKey: false }
);

// ─────────────────────────────────────────────
//  ADMIN REPLY SUB-SCHEMA
// ─────────────────────────────────────────────
const AdminReplySchema = new Schema(
  {
    body:      { type: String, required: [true, 'Reply body is required'], trim: true, maxlength: [2000, 'Reply cannot exceed 2000 characters'] },
    repliedAt: { type: Date, default: Date.now }
  },
  { _id: false, versionKey: false }
);

// ─────────────────────────────────────────────
//  COMMENT SUB-SCHEMA
// ─────────────────────────────────────────────
const CommentSchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment author is required']
    },
    body: {
      type: String,
      required: [true, 'Comment body is required'],
      trim: true,
      minlength: [1, 'Comment must be at least 1 character'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters']
    },
    isHidden: { type: Boolean, default: false },

    // Admin heart (like YouTube's creator heart)
    // true = admin has hearted this comment
    adminHearted: { type: Boolean, default: false },

    // Admin reply (one per comment)
    adminReply: { type: AdminReplySchema, default: null }
  },
  { timestamps: true, versionKey: false }
);

// ─────────────────────────────────────────────
//  REACTION SUB-SCHEMA
// ─────────────────────────────────────────────
const ReactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: { values: REACTION_TYPES, message: '"{VALUE}" is not a valid reaction' }, required: true }
  },
  { _id: false, versionKey: false }
);

// ─────────────────────────────────────────────
//  VIEW TRACKER SUB-SCHEMA
//  One entry per unique viewer (identified by fingerprint = IP+UA hash)
//  This keeps the array from ballooning with per-request duplicates.
// ─────────────────────────────────────────────
const ViewSchema = new Schema(
  {
    // SHA-256 hex of (ip + userAgent) — never stores raw PII
    fingerprint: { type: String, required: true },
    viewedAt:    { type: Date, default: Date.now }
  },
  { _id: false, versionKey: false }
);

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
    subtitle: { type: String, trim: true, maxlength: [500, 'Subtitle cannot exceed 500 characters'], default: '' },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      maxlength: [100, 'Slug cannot exceed 100 characters'],
      match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens']
    },

    // ── CONTENT ──
    blocks: { type: [BlockSchema], default: [] },

    // ── RENDER CACHE ──
    rendered_html: { type: String, default: '' },

    // ── SEARCH INDEX ──
    search_text: { type: String, default: '', select: false },

    // ── MEDIA ──
    coverImage: {
      url: {
        type: String, trim: true,
        validate: { validator: (v) => !v || /^(https?:\/\/.+|data:.+)/.test(v), message: 'coverImage.url must be a valid URL' }
      },
      alt: { type: String, trim: true, maxlength: [300, 'Cover image alt text cannot exceed 300 characters'] }
    },

    // ── TAXONOMY ──
    category: { type: String, enum: { values: CATEGORIES, message: '"{VALUE}" is not a valid category' }, index: true },
    tags: {
      type: [String],
      default: [],
      validate: { validator: (arr) => arr.length <= 20, message: 'Posts may not have more than 20 tags' }
    },

    // ── META ──
    author: { type: String, trim: true, default: 'Priya Sharma', maxlength: [100, 'Author name cannot exceed 100 characters'] },
    publishDate: { type: Date, index: true },
    readTime:    { type: String, trim: true },

    // ── STATS ──
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
      enum: { values: POST_STATUSES, message: '"{VALUE}" is not a valid status' },
      default: 'draft',
      index: true
    },

    lastSavedAt: { type: Date, default: Date.now },

    // ── COMMENTS ──
    comments: { type: [CommentSchema], default: [] },

    // ── REACTIONS (login required) ──
    reactions: { type: [ReactionSchema], default: [] },

    // ── REACTION COUNTS (denormalised for fast reads) ──
    reactionCounts: {
      read: { type: Number, default: 0, min: 0 },
      love: { type: Number, default: 0, min: 0 }
    },

    // ── GUEST REACTIONS (no login required) ──
    // Keyed by fingerprint → reaction type ('read'|'love')
    // Schema.Types.Mixed allows a flexible key-value map
    guestReactions: { type: Schema.Types.Mixed, default: {} },

    // ── VIEW TRACKING ──
    // Unique fingerprints — one entry per unique visitor
    views: { type: [ViewSchema], default: [], select: false },

    // Denormalised count so reads are O(1)
    viewCount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true, versionKey: '__v' }
);

// ─────────────────────────────────────────────
//  INDEXES
// ─────────────────────────────────────────────
PostSchema.index({ status: 1, publishDate: -1 });
PostSchema.index({ category: 1, status: 1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ 'settings.isFeatured': 1, status: 1 });
PostSchema.index({ search_text: 'text', title: 'text', subtitle: 'text' });
PostSchema.index({ 'reactions.user': 1, 'reactions.type': 1 });
// Efficient duplicate-view lookup
PostSchema.index({ 'views.fingerprint': 1 });

// ─────────────────────────────────────────────
//  CROSS-FIELD BLOCK VALIDATION
// ─────────────────────────────────────────────
PostSchema.pre('validate', function () {
  const errors = [];

  this.blocks.forEach((block, i) => {
    const prefix = `blocks[${i}] (type="${block.type}")`;

    switch (block.type) {
      case 'heading':
        if (!block.level || block.level < 1 || block.level > 3)
          errors.push(`${prefix}: level must be 1, 2, or 3`);
        if (!block.text || !block.text.trim())
          errors.push(`${prefix}: text is required`);
        break;
      case 'image':
        if (!block.url || !block.url.trim())
          errors.push(`${prefix}: url is required`);
        else if (!/^(https?:\/\/.+|data:.+)/.test(block.url))
          errors.push(`${prefix}: url must start with http://, https://, or data:`);
        break;
      case 'divider':
        if (!block.style || !DIVIDER_STYLES.includes(block.style))
          errors.push(`${prefix}: style must be one of [${DIVIDER_STYLES.join(', ')}]`);
        break;
      case 'list':
        if (!Array.isArray(block.items) || block.items.length === 0)
          errors.push(`${prefix}: items must be a non-empty array`);
        break;
      case 'code':
        if (!block.text || !block.text.trim())
          errors.push(`${prefix}: text (code content) is required`);
        break;
      default:
        break;
    }
  });

  if (errors.length) throw new Error(errors.join('; '));
});

// ─────────────────────────────────────────────
//  PRE-SAVE HOOK
// ─────────────────────────────────────────────
PostSchema.pre('save', function () {
  if (this.isModified('title') && this.title && !this.isModified('slug')) {
    this.slug = buildSlug(this.title);
  }

  if (this.isModified('blocks')) {
    this.rendered_html       = renderBlocks(this.blocks);
    this.search_text         = extractText(this.blocks);
    this.stats.blockCount    = this.blocks.length;
    this.stats.imageCount    = this.blocks.filter(b => b.type === 'image').length;
    this.stats.wordCount     = countWords(this.search_text);

    if (!this.readTime || this._autoReadTime) {
      const mins         = Math.max(1, Math.ceil(this.stats.wordCount / WPM));
      this.readTime      = `${mins} min read`;
      this._autoReadTime = true;
    }
  }

  if (this.isModified('status') && this.status === 'published' && !this.publishDate) {
    this.publishDate = new Date();
  }

  if (this.isModified('reactions')) {
    this.reactionCounts.read = this.reactions.filter(r => r.type === 'read').length;
    this.reactionCounts.love = this.reactions.filter(r => r.type === 'love').length;
  }

  // Keep viewCount in sync when views array changes
  if (this.isModified('views')) {
    this.viewCount = this.views.length;
  }

  this.lastSavedAt = new Date();
});

// ─────────────────────────────────────────────
//  STATIC METHODS
// ─────────────────────────────────────────────
PostSchema.statics.findPublished = function (filter = {}, { page = 1, limit = 20, sort = { publishDate: -1 } } = {}) {
  const skip = (page - 1) * limit;
  return this.find({ status: 'published', ...filter })
    .sort(sort).skip(skip).limit(limit).lean();
};

PostSchema.statics.search = function (query, { limit = 20 } = {}) {
  return this.find(
    { $text: { $search: query }, status: 'published' },
    { score: { $meta: 'textScore' }, search_text: 0 }
  ).sort({ score: { $meta: 'textScore' } }).limit(limit).lean();
};

// ─────────────────────────────────────────────
//  INSTANCE METHODS
// ─────────────────────────────────────────────
PostSchema.methods.publish = function () {
  this.status      = 'published';
  this.publishDate = this.publishDate || new Date();
  return this.save();
};

PostSchema.methods.archive = function () {
  this.status = 'archived';
  return this.save();
};

// ─────────────────────────────────────────────
//  VIRTUAL
// ─────────────────────────────────────────────
PostSchema.virtual('readTimeMinutes').get(function () {
  return Math.max(1, Math.ceil(this.stats.wordCount / WPM));
});

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function buildSlug(title) {
  return title.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '').substring(0, 100);
}

function countWords(text) {
  const trimmed = (text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function renderBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return '';
  return blocks.map(b => {
    switch (b.type) {
      case 'paragraph':   return `<p>${b.html || b.text || ''}</p>`;
      case 'heading':     return `<h${b.level || 2}>${escapeText(b.text)}</h${b.level || 2}>`;
      case 'blockquote':  return `<blockquote>${escapeText(b.text)}</blockquote>`;
      case 'pullquote':   return `<div class="pullquote">${escapeText(b.text)}</div>`;
      case 'idea':        return `<div class="editor-idea">💡 ${escapeText(b.text)}</div>`;
      case 'warning':     return `<div class="editor-warning">⚠️ ${escapeText(b.text)}</div>`;
      case 'info':        return `<div class="editor-info">ℹ️ ${escapeText(b.text)}</div>`;
      case 'image': {
        const src = escapeAttr(b.url || '');
        const alt = escapeAttr(b.alt || b.caption || '');
        const cap = b.caption ? `<figcaption>${escapeText(b.caption)}</figcaption>` : '';
        return `<figure><img src="${src}" alt="${alt}" loading="lazy"/>${cap}</figure>`;
      }
      case 'divider':
        return `<div class="divider divider--${escapeAttr(b.style || 'plain')}" aria-hidden="true"></div>`;
      case 'list': {
        const tag   = b.ordered ? 'ol' : 'ul';
        const items = (b.items || []).map(item => `<li>${escapeText(item)}</li>`).join('');
        return `<${tag}>${items}</${tag}>`;
      }
      case 'code': {
        const lang = b.language ? ` class="language-${escapeAttr(b.language)}"` : '';
        return `<pre><code${lang}>${escapeText(b.text || '')}</code></pre>`;
      }
      default: return '';
    }
  }).filter(Boolean).join('\n');
}

function extractText(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return '';
  return blocks.map(b => {
    switch (b.type) {
      case 'image':    return [b.caption, b.alt].filter(Boolean).join(' ');
      case 'divider':  return '';
      case 'list':     return (b.items || []).join(' ');
      case 'paragraph': return (b.html || b.text || '').replace(/<[^>]+>/g, '').trim();
      default:         return (b.text || '').trim();
    }
  }).filter(Boolean).join(' ');
}

const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
const escapeText = (str) => (str || '').replace(/[&<>"']/g, c => HTML_ESCAPE_MAP[c]);
const escapeAttr = (str) => (str || '').replace(/[&<>"']/g, c => HTML_ESCAPE_MAP[c]);

// ─────────────────────────────────────────────
//  MODEL EXPORT
// ─────────────────────────────────────────────
const Post = mongoose.models.Post || mongoose.model('Post', PostSchema);

module.exports = Post;