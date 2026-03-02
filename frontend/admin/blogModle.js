// models/Post.js
const mongoose = require('mongoose');

// ── Every block type your editor supports ──
const BlockSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true  // nanoid() on client — used for reordering, targeting
  },
  type: {
    type: String,
    required: true,
    enum: [
      'paragraph',
      'heading',
      'blockquote',
      'pullquote',
      'idea',
      'warning',
      'info',
      'image',
      'divider',
      'list',
      'code'
    ]
  },
  data: {
    // ── Text blocks ──
    text:         String,  // paragraph, blockquote, pullquote, idea, warning, info
    html:         String,  // paragraph (stores inline bold/italic/links)

    // ── Heading ──
    level:        Number,  // 1 | 2 | 3

    // ── Image ──
    url:          String,
    caption:      String,
    alt:          String,

    // ── Divider ──
    style: {
      type: String,
      enum: ['diamond', 'flame', 'stars', 'wave', 'plain']
    },

    // ── List ──
    ordered:      Boolean,
    items:        [String],

    // ── Code ──
    code:         String,
    language:     String
  }
}, { _id: false }); // no extra _id per block, we manage our own id field


const PostSchema = new mongoose.Schema({

  // ── CORE ──
  title:    { type: String, required: true, trim: true, maxlength: 300 },
  subtitle: { type: String, trim: true, maxlength: 500 },

  // ── CONTENT (source of truth) ──
  blocks: {
    type: [BlockSchema],
    default: []
  },

  // ── RENDERED CACHE (for fast read, SEO, preview) ──
  // Regenerated on every save — never edit this directly
  rendered_html: {
    type: String,
    default: ''
  },

  // ── PLAIN TEXT (for search index) ──
  // Strip all HTML/blocks → pure text → Atlas Search or regex search
  search_text: {
    type: String,
    default: '',
    select: false  // never returned in normal queries, only for search
  },

  // ── MEDIA ──
  coverImage: {
    url:   String,
    alt:   String
  },

  // ── TAXONOMY ──
  category: {
    type: String,
    enum: ['traditions','artisan-crafts','festivals','wellness','community','sacred-recipes'],
    index: true
  },
  tags:   { type: [String], index: true },

  // ── META ──
  author:      { type: String, default: 'Priya Sharma' },
  publishDate: { type: Date, index: true },
  readTime:    String,
  slug:        { type: String, unique: true, sparse: true },

  // ── STATS ──
  stats: {
    wordCount:  { type: Number, default: 0 },
    blockCount: { type: Number, default: 0 },
    imageCount: { type: Number, default: 0 }
  },

  // ── SETTINGS ──
  settings: {
    isFeatured:    { type: Boolean, default: false },
    allowComments: { type: Boolean, default: true }
  },

  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },

  lastSavedAt: { type: Date, default: Date.now }

}, { timestamps: true });

// ── INDEXES ──
PostSchema.index({ status: 1, publishDate: -1 });
PostSchema.index({ category: 1, status: 1 });
PostSchema.index({ search_text: 'text' }); // MongoDB full-text search

// ── PRE-SAVE HOOK — renders HTML + builds search_text automatically ──
PostSchema.pre('save', function(next) {

  // 1. Slug
  if (this.isModified('title') && this.title) {
    this.slug = this.title.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80);
  }

  // 2. Render HTML from blocks
  if (this.isModified('blocks')) {
    this.rendered_html  = renderBlocks(this.blocks);
    this.search_text    = extractText(this.blocks);
    this.stats.blockCount = this.blocks.length;
    this.stats.imageCount = this.blocks.filter(b => b.type === 'image').length;
    this.stats.wordCount  = this.search_text.trim().split(/\s+/).length;
  }

  next();
});

// ── RENDERER — blocks → HTML ──
function renderBlocks(blocks) {
  return blocks.map(b => {
    switch (b.type) {
      case 'paragraph':  return `<p>${b.data.html || b.data.text || ''}</p>`;
      case 'heading':    return `<h${b.data.level}>${b.data.text}</h${b.data.level}>`;
      case 'blockquote': return `<blockquote>${b.data.text}</blockquote>`;
      case 'pullquote':  return `<div class="pullquote">${b.data.text}</div>`;
      case 'idea':       return `<div class="editor-idea">💡 ${b.data.text}</div>`;
      case 'warning':    return `<div class="editor-warning">⚠️ ${b.data.text}</div>`;
      case 'info':       return `<div class="editor-info">ℹ️ ${b.data.text}</div>`;
      case 'image':      return `<figure><img src="${b.data.url}" alt="${b.data.alt || ''}"/><figcaption>${b.data.caption || ''}</figcaption></figure>`;
      case 'divider':    return `<div class="divider divider--${b.data.style}"></div>`;
      case 'list':
        const tag  = b.data.ordered ? 'ol' : 'ul';
        const items = (b.data.items || []).map(i => `<li>${i}</li>`).join('');
        return `<${tag}>${items}</${tag}>`;
      case 'code':       return `<pre><code>${b.data.code}</code></pre>`;
      default:           return '';
    }
  }).join('\n');
}

// ── TEXT EXTRACTOR — for search index ──
function extractText(blocks) {
  return blocks.map(b => {
    const d = b.data;
    if (b.type === 'image')   return d.caption || '';
    if (b.type === 'divider') return '';
    if (b.type === 'list')    return (d.items || []).join(' ');
    return (d.html || d.text || '').replace(/<[^>]+>/g, ''); // strip inline HTML tags
  }).join(' ');
}

module.exports = mongoose.model('Post', PostSchema);