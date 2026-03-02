'use strict';

// middlewares/validatePost.js

const AppError = require('../utils/AppError');

// ── Mirror constants from blogModel (single source of truth kept in model) ──
const VALID_BLOCK_TYPES = [
  'paragraph', 'heading', 'blockquote', 'pullquote',
  'idea', 'warning', 'info', 'image', 'divider', 'list', 'code'
];
const VALID_DIVIDER_STYLES = ['diamond', 'flame', 'stars', 'wave', 'plain'];
const VALID_CATEGORIES = [
  'traditions', 'artisan-crafts', 'festivals',
  'wellness', 'community', 'sacred-recipes'
];
const VALID_STATUSES = ['draft', 'published', 'archived'];

// ─────────────────────────────────────────────
//  INTERNAL HELPERS
// ─────────────────────────────────────────────

/**
 * Throw ONE AppError that lists every problem at once —
 * so the client sees the full picture in a single request.
 */
const fail = (errors) =>
  new AppError(`Validation failed: ${errors.join(' | ')}`, 400);

/**
 * Return a NEW object containing only the listed keys.
 * Protects controllers from mass-assignment.
 */
const pick = (obj, ...keys) => {
  const out = {};
  keys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  });
  return out;
};

// ─────────────────────────────────────────────
//  BLOCK ARRAY VALIDATOR
// ─────────────────────────────────────────────
const validateBlocks = (blocks) => {
  const errors = [];

  if (!Array.isArray(blocks)) {
    errors.push('blocks must be an array');
    return errors;
  }

  blocks.forEach((block, i) => {
    const p = `blocks[${i}]`;

    if (!block || typeof block !== 'object') {
      errors.push(`${p}: must be an object`);
      return;
    }

    // id — required, non-empty string
    if (!block.id || typeof block.id !== 'string' || !block.id.trim()) {
      errors.push(`${p}: id is required and must be a non-empty string`);
    }

    // type — must be a known value before we check type-specific rules
    if (!block.type || !VALID_BLOCK_TYPES.includes(block.type)) {
      errors.push(
        `${p}: type must be one of [${VALID_BLOCK_TYPES.join(', ')}], received "${block.type}"`
      );
      return;
    }

    switch (block.type) {
      case 'heading':
        if (!block.level || ![1, 2, 3].includes(Number(block.level))) {
          errors.push(`${p} (heading): level must be 1, 2, or 3`);
        }
        if (!block.text || !String(block.text).trim()) {
          errors.push(`${p} (heading): text is required`);
        }
        break;

      case 'image':
        if (!block.url || !String(block.url).trim()) {
          errors.push(`${p} (image): url is required`);
        } else if (!/^(https?:\/\/.+|data:.+)/.test(block.url)) {
          errors.push(`${p} (image): url must begin with http://, https://, or data:`);
        }
        if (block.caption && String(block.caption).length > 500) {
          errors.push(`${p} (image): caption cannot exceed 500 characters`);
        }
        break;

      case 'divider':
        if (!block.style || !VALID_DIVIDER_STYLES.includes(block.style)) {
          errors.push(
            `${p} (divider): style must be one of [${VALID_DIVIDER_STYLES.join(', ')}]`
          );
        }
        break;

      case 'list':
        if (!Array.isArray(block.items) || block.items.length === 0) {
          errors.push(`${p} (list): items must be a non-empty array`);
        }
        break;

      case 'code':
        if (!block.text || !String(block.text).trim()) {
          errors.push(`${p} (code): text (code content) is required`);
        }
        break;

      // paragraph, blockquote, pullquote, idea, warning, info
      // text/html are optional — editors may create empty draft blocks
      default:
        break;
    }
  });

  return errors;
};

// ─────────────────────────────────────────────
//  POST — CREATE
// ─────────────────────────────────────────────
exports.validateCreatePost = (req, res, next) => {
  const errors = [];
  const { title, subtitle, blocks, category, tags, settings, status, coverImage } = req.body;

  // title — required
  if (!title || !String(title).trim()) {
    errors.push('title is required');
  } else if (String(title).trim().length > 300) {
    errors.push('title cannot exceed 300 characters');
  }

  // subtitle — optional
  if (subtitle !== undefined && String(subtitle).length > 500) {
    errors.push('subtitle cannot exceed 500 characters');
  }

  // blocks — optional array
  if (blocks !== undefined) {
    errors.push(...validateBlocks(blocks));
  }

  // category — optional enum
  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    errors.push(`category must be one of [${VALID_CATEGORIES.join(', ')}]`);
  }

  // tags — optional array, max 20
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      errors.push('tags must be an array');
    } else if (tags.length > 20) {
      errors.push('posts may not have more than 20 tags');
    }
  }

  // status — optional enum (defaults to draft in model)
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    errors.push(`status must be one of [${VALID_STATUSES.join(', ')}]`);
  }

  // settings — optional object
  if (settings !== undefined) {
    if (typeof settings !== 'object' || Array.isArray(settings)) {
      errors.push('settings must be an object');
    } else {
      if (
        settings.isFeatured !== undefined &&
        typeof settings.isFeatured !== 'boolean'
      ) {
        errors.push('settings.isFeatured must be a boolean');
      }
      if (
        settings.allowComments !== undefined &&
        typeof settings.allowComments !== 'boolean'
      ) {
        errors.push('settings.allowComments must be a boolean');
      }
    }
  }

  // coverImage — optional object with URL
  if (coverImage !== undefined) {
    if (typeof coverImage !== 'object' || Array.isArray(coverImage)) {
      errors.push('coverImage must be an object');
    } else if (coverImage.url && !/^(https?:\/\/.+|data:.+)/.test(coverImage.url)) {
      errors.push('coverImage.url must be a valid http/https URL or data URI');
    }
  }

  if (errors.length) return next(fail(errors));

  // Strip unknown keys — protect against mass-assignment
  req.body = pick(
    req.body,
    'title', 'subtitle', 'slug', 'blocks',
    'coverImage', 'category', 'tags',
    'author', 'publishDate', 'readTime',
    'settings', 'status'
  );

  next();
};

// ─────────────────────────────────────────────
//  POST — UPDATE  (all fields optional)
// ─────────────────────────────────────────────
exports.validateUpdatePost = (req, res, next) => {
  const errors = [];
  const { title, subtitle, blocks, category, tags, settings, status, coverImage } = req.body;

  if (!Object.keys(req.body).length) {
    return next(new AppError('Request body is empty. Provide at least one field to update.', 400));
  }

  if (title !== undefined) {
    if (!String(title).trim()) {
      errors.push('title cannot be blank');
    } else if (String(title).trim().length > 300) {
      errors.push('title cannot exceed 300 characters');
    }
  }

  if (subtitle !== undefined && String(subtitle).length > 500) {
    errors.push('subtitle cannot exceed 500 characters');
  }

  if (blocks !== undefined) {
    errors.push(...validateBlocks(blocks));
  }

  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    errors.push(`category must be one of [${VALID_CATEGORIES.join(', ')}]`);
  }

  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      errors.push('tags must be an array');
    } else if (tags.length > 20) {
      errors.push('posts may not have more than 20 tags');
    }
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    errors.push(`status must be one of [${VALID_STATUSES.join(', ')}]`);
  }

  if (settings !== undefined) {
    if (typeof settings !== 'object' || Array.isArray(settings)) {
      errors.push('settings must be an object');
    } else {
      if (
        settings.isFeatured !== undefined &&
        typeof settings.isFeatured !== 'boolean'
      ) {
        errors.push('settings.isFeatured must be a boolean');
      }
      if (
        settings.allowComments !== undefined &&
        typeof settings.allowComments !== 'boolean'
      ) {
        errors.push('settings.allowComments must be a boolean');
      }
    }
  }

  if (coverImage !== undefined) {
    if (typeof coverImage !== 'object' || Array.isArray(coverImage)) {
      errors.push('coverImage must be an object');
    } else if (coverImage.url && !/^https?:\/\/.+/.test(coverImage.url)) {
      errors.push('coverImage.url must be a valid http/https URL');
    }
  }

  if (errors.length) return next(fail(errors));

  req.body = pick(
    req.body,
    'title', 'subtitle', 'slug', 'blocks',
    'coverImage', 'category', 'tags',
    'author', 'publishDate', 'readTime',
    'settings', 'status'
  );

  next();
};

// ─────────────────────────────────────────────
//  COMMENT — CREATE
// ─────────────────────────────────────────────
exports.validateCreateComment = (req, res, next) => {
  const { body } = req.body;

  if (!body || !String(body).trim()) {
    return next(new AppError('Comment body is required', 400));
  }
  if (String(body).trim().length > 1000) {
    return next(new AppError('Comment cannot exceed 1000 characters', 400));
  }

  // Sanitise — only pass body forward
  req.body = { body: String(body).trim() };
  next();
};

// ─────────────────────────────────────────────
//  COMMENT — UPDATE
// ─────────────────────────────────────────────
exports.validateUpdateComment = (req, res, next) => {
  const { body } = req.body;

  if (body === undefined) {
    return next(new AppError('body field is required to update a comment', 400));
  }
  if (!String(body).trim()) {
    return next(new AppError('Comment body cannot be blank', 400));
  }
  if (String(body).trim().length > 1000) {
    return next(new AppError('Comment cannot exceed 1000 characters', 400));
  }

  req.body = { body: String(body).trim() };
  next();
};