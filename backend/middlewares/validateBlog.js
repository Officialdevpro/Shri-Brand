'use strict';

const AppError = require('../utils/AppError');

// ─────────────────────────────────────────────
//  CONSTANTS (mirror blogModel.js)
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

const TITLE_MAX = 300;
const SUBTITLE_MAX = 500;
const AUTHOR_MAX = 100;
const TAGS_MAX = 20;
const TAG_LENGTH_MAX = 60;
const COMMENT_MIN = 1;
const COMMENT_MAX = 2000;
const READTIME_MAX = 50;
const CAPTION_MAX = 500;
const ALT_MAX = 300;
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const URL_PATTERN = /^(https?:\/\/.+|data:.+)/;

// ─────────────────────────────────────────────
//  GENERIC HELPERS
// ─────────────────────────────────────────────

/**
 * Collect all field errors and return a single formatted 400 AppError.
 * Keeps the entire error list visible to the client in one shot.
 */
function buildError(errors) {
  if (!errors.length) return null;
  const message =
    errors.length === 1
      ? errors[0]
      : `Validation failed with ${errors.length} errors: ${errors.join(' | ')}`;
  const err = new AppError(message, 400);
  err.validationErrors = errors; // handy for consumers / tests
  return err;
}

/** Trim a string safely; returns '' for nullish values. */
const trim = (v) => (typeof v === 'string' ? v.trim() : '');

// ─────────────────────────────────────────────
//  BLOCK VALIDATOR
// ─────────────────────────────────────────────

/**
 * Validates each block in the blocks array.
 * Returns an array of error strings (empty = valid).
 */
function validateBlocks(blocks) {
  const errors = [];

  if (!Array.isArray(blocks)) {
    errors.push('blocks must be an array');
    return errors;
  }

  if (blocks.length > 500) {
    errors.push('A post cannot have more than 500 blocks');
  }

  blocks.forEach((block, i) => {
    const prefix = `blocks[${i}]`;

    if (!block || typeof block !== 'object') {
      errors.push(`${prefix}: must be an object`);
      return;
    }

    // ── type ──
    if (!block.type) {
      errors.push(`${prefix}: type is required`);
      return; // can't validate further without type
    }
    if (!BLOCK_TYPES.includes(block.type)) {
      errors.push(
        `${prefix}: "${block.type}" is not a valid block type. Allowed: ${BLOCK_TYPES.join(', ')}`
      );
      return;
    }

    // ── id (optional but recommended) ──
    if (block.id !== undefined && typeof block.id !== 'string') {
      errors.push(`${prefix}: id must be a string`);
    }

    // ── type-specific rules ──
    switch (block.type) {
      case 'heading': {
        if (!block.level || ![1, 2, 3].includes(Number(block.level))) {
          errors.push(`${prefix} (heading): level must be 1, 2, or 3`);
        }
        if (!trim(block.text)) {
          errors.push(`${prefix} (heading): text is required`);
        }
        break;
      }

      case 'image': {
        if (!trim(block.url)) {
          errors.push(`${prefix} (image): url is required`);
        } else if (!URL_PATTERN.test(block.url)) {
          errors.push(`${prefix} (image): url must start with http:// or https://`);
        }
        if (block.caption && block.caption.length > CAPTION_MAX) {
          errors.push(`${prefix} (image): caption cannot exceed ${CAPTION_MAX} characters`);
        }
        if (block.alt && block.alt.length > ALT_MAX) {
          errors.push(`${prefix} (image): alt text cannot exceed ${ALT_MAX} characters`);
        }
        break;
      }

      case 'divider': {
        if (!block.style || !DIVIDER_STYLES.includes(block.style)) {
          errors.push(
            `${prefix} (divider): style must be one of [${DIVIDER_STYLES.join(', ')}]`
          );
        }
        break;
      }

      case 'list': {
        if (!Array.isArray(block.items) || block.items.length === 0) {
          errors.push(`${prefix} (list): items must be a non-empty array`);
        } else {
          block.items.forEach((item, j) => {
            if (typeof item !== 'string' || !item.trim()) {
              errors.push(`${prefix} (list): items[${j}] must be a non-empty string`);
            }
          });
        }
        break;
      }

      case 'code': {
        if (!trim(block.text)) {
          errors.push(`${prefix} (code): text (code content) is required`);
        }
        if (block.language !== undefined && typeof block.language !== 'string') {
          errors.push(`${prefix} (code): language must be a string`);
        }
        break;
      }

      // paragraph, blockquote, pullquote, idea, warning, info
      // — content is optional during drafting, so no required check
      default:
        break;
    }
  });

  return errors;
}

// ─────────────────────────────────────────────
//  POST VALIDATORS
// ─────────────────────────────────────────────

/**
 * Core post field validator shared by create and update.
 * `isCreate` enforces required fields that are optional on update.
 */
function validatePostFields(body, isCreate = false) {
  const errors = [];

  // ── title ──
  if (isCreate || body.title !== undefined) {
    const title = trim(body.title);
    if (!title) {
      errors.push('title is required');
    } else if (title.length > TITLE_MAX) {
      errors.push(`title cannot exceed ${TITLE_MAX} characters (currently ${title.length})`);
    }
  }

  // ── subtitle ──
  if (body.subtitle !== undefined) {
    const subtitle = trim(body.subtitle);
    if (subtitle.length > SUBTITLE_MAX) {
      errors.push(`subtitle cannot exceed ${SUBTITLE_MAX} characters (currently ${subtitle.length})`);
    }
  }

  // ── slug ──
  if (body.slug !== undefined) {
    const slug = trim(body.slug).toLowerCase();
    if (slug && !SLUG_PATTERN.test(slug)) {
      errors.push('slug may only contain lowercase letters, numbers, and hyphens');
    }
    if (slug.length > 100) {
      errors.push('slug cannot exceed 100 characters');
    }
  }

  // ── category ──
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) {
      errors.push(
        `"${body.category}" is not a valid category. Allowed: ${CATEGORIES.join(', ')}`
      );
    }
  }

  // ── tags ──
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      errors.push('tags must be an array of strings');
    } else {
      if (body.tags.length > TAGS_MAX) {
        errors.push(`tags cannot contain more than ${TAGS_MAX} entries (got ${body.tags.length})`);
      }
      body.tags.forEach((tag, i) => {
        if (typeof tag !== 'string') {
          errors.push(`tags[${i}] must be a string`);
        } else if (!tag.trim()) {
          errors.push(`tags[${i}] cannot be an empty string`);
        } else if (tag.length > TAG_LENGTH_MAX) {
          errors.push(`tags[${i}] cannot exceed ${TAG_LENGTH_MAX} characters`);
        }
      });
    }
  }

  // ── author ──
  if (body.author !== undefined) {
    const author = trim(body.author);
    if (author.length > AUTHOR_MAX) {
      errors.push(`author cannot exceed ${AUTHOR_MAX} characters`);
    }
  }

  // ── publishDate ──
  if (body.publishDate !== undefined && body.publishDate !== null && body.publishDate !== '') {
    const d = new Date(body.publishDate);
    if (isNaN(d.getTime())) {
      errors.push(`publishDate "${body.publishDate}" is not a valid date`);
    }
  }

  // ── readTime ──
  if (body.readTime !== undefined) {
    const rt = trim(body.readTime);
    if (rt.length > READTIME_MAX) {
      errors.push(`readTime cannot exceed ${READTIME_MAX} characters`);
    }
  }

  // ── coverImage ──
  if (body.coverImage !== undefined && body.coverImage !== null) {
    if (typeof body.coverImage !== 'object') {
      errors.push('coverImage must be an object with a url field');
    } else {
      const coverUrl = trim(body.coverImage.url);
      if (coverUrl && !URL_PATTERN.test(coverUrl)) {
        errors.push('coverImage.url must be a valid http/https URL');
      }
      if (body.coverImage.alt && body.coverImage.alt.length > ALT_MAX) {
        errors.push(`coverImage.alt cannot exceed ${ALT_MAX} characters`);
      }
    }
  }

  // ── status ──
  if (body.status !== undefined) {
    if (!POST_STATUSES.includes(body.status)) {
      errors.push(
        `"${body.status}" is not a valid status. Allowed: ${POST_STATUSES.join(', ')}`
      );
    }
  }

  // ── settings ──
  if (body.settings !== undefined) {
    if (typeof body.settings !== 'object' || Array.isArray(body.settings)) {
      errors.push('settings must be an object');
    } else {
      if (
        body.settings.isFeatured !== undefined &&
        typeof body.settings.isFeatured !== 'boolean'
      ) {
        errors.push('settings.isFeatured must be a boolean');
      }
      if (
        body.settings.allowComments !== undefined &&
        typeof body.settings.allowComments !== 'boolean'
      ) {
        errors.push('settings.allowComments must be a boolean');
      }
    }
  }

  // ── blocks ──
  if (body.blocks !== undefined) {
    const blockErrors = validateBlocks(body.blocks);
    errors.push(...blockErrors);
  }

  return errors;
}

// ─────────────────────────────────────────────
//  EXPORTED MIDDLEWARE
// ─────────────────────────────────────────────

/**
 * POST /api/v1/blogs
 * Validates all required + optional fields for creating a new post.
 */
exports.validateCreatePost = (req, res, next) => {
  const errors = validatePostFields(req.body, true); // isCreate = true
  const err = buildError(errors);
  if (err) return next(err);
  next();
};

/**
 * PATCH /api/v1/blogs/:id
 * Validates only the fields provided; skips missing optional fields.
 * Rejects completely empty bodies.
 */
exports.validateUpdatePost = (req, res, next) => {
  const UPDATABLE = [
    'title', 'subtitle', 'slug', 'blocks', 'coverImage',
    'category', 'tags', 'author', 'publishDate', 'readTime',
    'settings', 'status'
  ];

  const provided = Object.keys(req.body).filter(k => UPDATABLE.includes(k));

  if (provided.length === 0) {
    return next(
      new AppError(
        'Update body must contain at least one updatable field: ' + UPDATABLE.join(', '),
        400
      )
    );
  }

  const errors = validatePostFields(req.body, false); // isCreate = false
  const err = buildError(errors);
  if (err) return next(err);
  next();
};

// ─────────────────────────────────────────────
//  COMMENT VALIDATORS
// ─────────────────────────────────────────────

/**
 * POST /api/v1/blogs/:id/comments
 */
exports.validateCreateComment = (req, res, next) => {
  const errors = [];

  const body = trim(req.body.body);

  if (!body) {
    errors.push('Comment body is required');
  } else {
    if (body.length < COMMENT_MIN) {
      errors.push(`Comment must be at least ${COMMENT_MIN} character`);
    }
    if (body.length > COMMENT_MAX) {
      errors.push(
        `Comment cannot exceed ${COMMENT_MAX} characters (currently ${body.length})`
      );
    }
  }

  // Sanitise: replace body with trimmed version so controller receives clean data
  if (!errors.length) req.body.body = body;

  const err = buildError(errors);
  if (err) return next(err);
  next();
};

/**
 * PATCH /api/v1/blogs/:id/comments/:commentId
 */
exports.validateUpdateComment = (req, res, next) => {
  const errors = [];

  if (req.body.body === undefined) {
    errors.push('body is required to update a comment');
  } else {
    const body = trim(req.body.body);

    if (!body) {
      errors.push('Comment body cannot be empty');
    } else if (body.length > COMMENT_MAX) {
      errors.push(
        `Comment cannot exceed ${COMMENT_MAX} characters (currently ${body.length})`
      );
    }

    if (!errors.length) req.body.body = body;
  }

  const err = buildError(errors);
  if (err) return next(err);
  next();
};