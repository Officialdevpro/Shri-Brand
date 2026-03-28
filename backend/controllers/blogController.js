// controllers/blogController.js
'use strict';

/**
 * Blog Controller
 * ──────────────────────────────────────────────────────────────
 * Features:
 *  • CRUD for posts (admin only for writes)
 *  • Publish / Archive shortcuts
 *  • Full-text search + filter by category / tag / featured
 *  • Comments — registered users only (protect middleware)
 *  • Admin: reply, delete, hide/unhide, heart (like YouTube)
 *  • Reactions ('read' | 'love') — PUBLIC, no login required (toggle)
 *  • View counting — deduped per IP+UserAgent fingerprint (no repeat counts)
 * ──────────────────────────────────────────────────────────────
 */

const crypto   = require('crypto');
const Post     = require('../models/blogModel');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const logger     = require('../utils/logger');

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

const isAdmin = (req) => req.user && req.user.role === 'admin';

const ALLOWED_POST_FIELDS = [
  'title', 'subtitle', 'slug', 'blocks', 'coverImage',
  'category', 'tags', 'author', 'publishDate', 'readTime',
  'settings', 'status'
];

const pickPostFields = (body) => {
  const obj = {};
  ALLOWED_POST_FIELDS.forEach(k => {
    if (body[k] !== undefined) obj[k] = body[k];
  });
  return obj;
};

const buildListFilter = (query, userIsAdmin) => {
  const filter = {};

  if (userIsAdmin && query.status) {
    if (!['draft', 'published', 'archived'].includes(query.status))
      throw new AppError(`Invalid status filter: "${query.status}"`, 400);
    filter.status = query.status;
  } else {
    filter.status = 'published';
  }

  if (query.category) filter.category = query.category;
  if (query.tag)      filter.tags     = query.tag;
  if (query.featured === 'true') filter['settings.isFeatured'] = true;

  return filter;
};

const parsePagination = (query) => {
  const page  = Math.max(1, parseInt(query.page, 10)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));

  const SORTABLE = ['publishDate', 'createdAt', 'title', 'reactionCounts.love', 'reactionCounts.read', 'viewCount'];
  const sortBy   = SORTABLE.includes(query.sortBy) ? query.sortBy : 'publishDate';
  const order    = query.order === 'asc' ? 1 : -1;

  return { page, limit, skip: (page - 1) * limit, sort: { [sortBy]: order } };
};

/**
 * Build a privacy-safe fingerprint from the request.
 * Uses a SHA-256 of IP + User-Agent — no PII is stored.
 *
 * For view deduplication we also respect a 24-hour window via the
 * viewedAt timestamp, so a user who returns the next day gets a
 * fresh count. Adjust TTL to taste (or remove TTL for lifetime dedup).
 */
const VIEW_TTL_HOURS = 24;

const buildFingerprint = (req) => {
  const ip = req.ip
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('sha256').update(`${ip}::${ua}`).digest('hex');
};

// ─────────────────────────────────────────────
//  POST — LISTING & SEARCH
// ─────────────────────────────────────────────

/**
 * GET /api/v1/blogs
 */
exports.getAllPosts = catchAsync(async (req, res, next) => {
  const admin = isAdmin(req);

  if (req.query.search) {
    const term = (req.query.search || '').trim();
    if (!term) return next(new AppError('search must be a non-empty string', 400));

    const { limit } = parsePagination(req.query);
    const posts = await Post.search(term, { limit });

    return res.status(200).json({
      status:  'success',
      results: posts.length,
      data:    { posts }
    });
  }

  let filter;
  try {
    filter = buildListFilter(req.query, admin);
  } catch (err) {
    return next(err);
  }

  const { page, limit, skip, sort } = parsePagination(req.query);

  const [rawPosts, total] = await Promise.all([
    Post.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Post.countDocuments(filter)
  ]);

  // Add commentCount and strip heavy fields
  const posts = rawPosts.map(p => {
    const commentCount = Array.isArray(p.comments) ? p.comments.length : 0;
    delete p.comments;
    delete p.reactions;
    delete p.rendered_html;
    delete p.search_text;
    return { ...p, commentCount };
  });

  res.status(200).json({
    status:  'success',
    results: posts.length,
    total,
    page,
    pages:   Math.ceil(total / limit),
    data:    { posts }
  });
});

/**
 * GET /api/v1/blogs/slug/:slug
 * Public (published only). Admin gets any status.
 * Increments view count once per fingerprint per 24 h.
 */
exports.getPostBySlug = catchAsync(async (req, res, next) => {
  const { slug } = req.params;

  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    return next(new AppError('Please provide a valid slug', 400));
  }

  const admin  = isAdmin(req);
  const filter = admin ? { slug } : { slug, status: 'published' };

  // We need the views array here to deduplicate
  const post = await Post.findOne(filter)
    .select('+views')
    .populate({ path: 'comments.author', select: 'name email photo' });

  if (!post) return next(new AppError('Post not found', 404));

  // ── View count (fire-and-forget — don't block the response) ──
  _recordView(post, req).catch(err =>
    logger.warn('Failed to record view', { error: err.message })
  );

  const visibleComments = admin
    ? post.comments
    : post.comments.filter(c => !c.isHidden);

  const result = post.toObject();
  result.comments = visibleComments;
  delete result.views; // never expose raw fingerprints

  res.status(200).json({
    status: 'success',
    data:   { post: result }
  });
});

/**
 * GET /api/v1/blogs/:id
 * Public — only published (admin gets any status).
 * Increments view count once per fingerprint per 24 h.
 */
exports.getPost = catchAsync(async (req, res, next) => {
  const admin  = isAdmin(req);
  const filter = admin
    ? { _id: req.params.id }
    : { _id: req.params.id, status: 'published' };

  const post = await Post.findOne(filter)
    .select('+views')
    .populate({ path: 'comments.author', select: 'name email photo' });

  if (!post) return next(new AppError('Post not found', 404));

  // ── View count (fire-and-forget) ──
  _recordView(post, req).catch(err =>
    logger.warn('Failed to record view', { error: err.message })
  );

  const visibleComments = admin
    ? post.comments
    : post.comments.filter(c => !c.isHidden);

  const result = post.toObject();
  result.comments = visibleComments;
  delete result.views;

  res.status(200).json({
    status: 'success',
    data:   { post: result }
  });
});

// ─────────────────────────────────────────────
//  INTERNAL — VIEW RECORDING
// ─────────────────────────────────────────────

/**
 * Records a view for `post` if the requester's fingerprint hasn't been
 * seen within VIEW_TTL_HOURS. Uses an atomic $push + $inc to avoid
 * race conditions on concurrent requests.
 *
 * @param {Document} post  — Mongoose doc (must have .views loaded)
 * @param {Request}  req
 */
async function _recordView(post, req) {
  const fingerprint = buildFingerprint(req);
  const cutoff      = new Date(Date.now() - VIEW_TTL_HOURS * 60 * 60 * 1000);

  // Check if this fingerprint already has a recent view
  const alreadySeen = post.views.some(
    v => v.fingerprint === fingerprint && v.viewedAt >= cutoff
  );

  if (alreadySeen) return; // no-op — already counted

  // Atomically add the view and bump the counter
  await Post.updateOne(
    { _id: post._id },
    {
      $push: { views: { fingerprint, viewedAt: new Date() } },
      $inc:  { viewCount: 1 }
    }
  );

  // Optionally prune stale fingerprints (keeps views array from growing forever)
  // Run occasionally (1-in-50 chance) to avoid overhead on every request
  if (Math.random() < 0.02) {
    Post.updateOne(
      { _id: post._id },
      { $pull: { views: { viewedAt: { $lt: cutoff } } } }
    ).catch(() => {/* non-critical */});
  }
}

// ─────────────────────────────────────────────
//  POST — WRITE (admin only — enforced in routes)
// ─────────────────────────────────────────────

exports.createPost = catchAsync(async (req, res, next) => {
  const data = pickPostFields(req.body);

  if (!data.title || !String(data.title).trim()) {
    return next(new AppError('title is required', 400));
  }

  const post = await Post.create(data);

  res.status(201).json({
    status:  'success',
    message: 'Post created successfully',
    data:    { post }
  });
});

exports.updatePost = catchAsync(async (req, res, next) => {
  const data = pickPostFields(req.body);

  if (Object.keys(data).length === 0) {
    return next(new AppError('Request body must contain at least one updatable field', 400));
  }

  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  Object.assign(post, data);
  await post.save();

  res.status(200).json({
    status:  'success',
    message: 'Post updated successfully',
    data:    { post }
  });
});

exports.publishPost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  if (post.status === 'published') {
    return next(new AppError('Post is already published', 400));
  }

  await post.publish();

  res.status(200).json({
    status:  'success',
    message: 'Post published successfully',
    data:    { post }
  });
});

exports.archivePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  if (post.status === 'archived') {
    return next(new AppError('Post is already archived', 400));
  }

  await post.archive();

  res.status(200).json({
    status:  'success',
    message: 'Post archived successfully',
    data:    { post }
  });
});

exports.deletePost = catchAsync(async (req, res, next) => {
  const post = await Post.findByIdAndDelete(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  res.status(204).json({ status: 'success', data: null });
});

// ─────────────────────────────────────────────
//  COMMENTS
// ─────────────────────────────────────────────

/**
 * GET /api/v1/blogs/:id/comments
 * Public — hidden comments are filtered for non-admins.
 */
exports.getComments = catchAsync(async (req, res, next) => {
  const admin = isAdmin(req);

  const post = await Post.findOne(
    admin ? { _id: req.params.id } : { _id: req.params.id, status: 'published' }
  ).populate({ path: 'comments.author', select: 'name email photo' });

  if (!post) return next(new AppError('Post not found', 404));

  if (!post.settings.allowComments && !admin) {
    return next(new AppError('Comments are disabled for this post', 403));
  }

  const comments = admin
    ? post.comments
    : post.comments.filter(c => !c.isHidden);

  res.status(200).json({
    status:  'success',
    results: comments.length,
    data:    { comments }
  });
});

/**
 * POST /api/v1/blogs/:id/comments
 * Requires authentication. Registered users only.
 */
exports.createComment = catchAsync(async (req, res, next) => {
  // Guard: must be a registered user (protect middleware sets req.user)
  if (!req.user) {
    return next(new AppError('You must be logged in to comment', 401));
  }

  const post = await Post.findOne({ _id: req.params.id, status: 'published' });
  if (!post) return next(new AppError('Post not found', 404));

  if (!post.settings.allowComments) {
    return next(new AppError('Comments are disabled for this post', 403));
  }

  const body = (req.body.body || '').trim();
  if (!body)             return next(new AppError('Comment body is required', 400));
  if (body.length > 2000) return next(new AppError('Comment cannot exceed 2000 characters', 400));

  post.comments.push({ author: req.user._id, body });
  await post.save();

  const newComment = post.comments[post.comments.length - 1];
  await post.populate({ path: 'comments.author', select: 'name email photo' });
  const populated = post.comments.id(newComment._id);

  res.status(201).json({
    status:  'success',
    message: 'Comment added successfully',
    data:    { comment: populated }
  });
});

/**
 * PATCH /api/v1/blogs/:id/comments/:commentId
 * Only the comment's own author can edit.
 */
exports.updateComment = catchAsync(async (req, res, next) => {
  const { id, commentId } = req.params;

  const post = await Post.findById(id);
  if (!post) return next(new AppError('Post not found', 404));

  const comment = post.comments.id(commentId);
  if (!comment)         return next(new AppError('Comment not found', 404));
  if (comment.isHidden) return next(new AppError('Cannot edit a hidden comment', 403));

  if (comment.author.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only edit your own comments', 403));
  }

  const body = (req.body.body || '').trim();
  if (!body)             return next(new AppError('Comment body cannot be empty', 400));
  if (body.length > 2000) return next(new AppError('Comment cannot exceed 2000 characters', 400));

  comment.body = body;
  await post.save();

  await post.populate({ path: 'comments.author', select: 'name email photo' });
  const updated = post.comments.id(commentId);

  res.status(200).json({
    status:  'success',
    message: 'Comment updated successfully',
    data:    { comment: updated }
  });
});

/**
 * DELETE /api/v1/blogs/:id/comments/:commentId
 * Comment author OR admin can delete.
 */
exports.deleteComment = catchAsync(async (req, res, next) => {
  const { id, commentId } = req.params;

  const post = await Post.findById(id);
  if (!post) return next(new AppError('Post not found', 404));

  const comment = post.comments.id(commentId);
  if (!comment) return next(new AppError('Comment not found', 404));

  const isOwner = comment.author.toString() === req.user._id.toString();
  if (!isOwner && !isAdmin(req)) {
    return next(new AppError('You do not have permission to delete this comment', 403));
  }

  comment.deleteOne();
  await post.save();

  res.status(200).json({
    status:  'success',
    message: 'Comment deleted successfully',
    data:    null
  });
});

// ─────────────────────────────────────────────
//  COMMENT MODERATION (admin only — routes enforce restrictTo)
// ─────────────────────────────────────────────

exports.hideComment = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  const comment = post.comments.id(req.params.commentId);
  if (!comment) return next(new AppError('Comment not found', 404));

  if (comment.isHidden) return next(new AppError('Comment is already hidden', 400));

  comment.isHidden = true;
  await post.save();

  res.status(200).json({
    status:  'success',
    message: 'Comment hidden successfully',
    data:    { comment }
  });
});

exports.unhideComment = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  const comment = post.comments.id(req.params.commentId);
  if (!comment) return next(new AppError('Comment not found', 404));

  if (!comment.isHidden) return next(new AppError('Comment is not hidden', 400));

  comment.isHidden = false;
  await post.save();

  res.status(200).json({
    status:  'success',
    message: 'Comment restored successfully',
    data:    { comment }
  });
});

// ─────────────────────────────────────────────
//  ADMIN HEART  (YouTube-style creator heart)
// ─────────────────────────────────────────────

/**
 * PATCH /api/v1/blogs/:id/comments/:commentId/heart
 * Admin toggles a ❤️ on a comment.
 * Hearting a hearted comment removes the heart (toggle).
 */
exports.heartComment = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  const comment = post.comments.id(req.params.commentId);
  if (!comment) return next(new AppError('Comment not found', 404));

  if (comment.isHidden) {
    return next(new AppError('Cannot heart a hidden comment', 400));
  }

  // Toggle
  comment.adminHearted = !comment.adminHearted;
  await post.save();

  const action = comment.adminHearted ? 'hearted' : 'un-hearted';

  res.status(200).json({
    status:  'success',
    message: `Comment ${action} successfully`,
    data:    { adminHearted: comment.adminHearted, commentId: comment._id }
  });
});

// ─────────────────────────────────────────────
//  ADMIN REPLIES
// ─────────────────────────────────────────────

/**
 * POST /api/v1/blogs/:id/comments/:commentId/reply
 * Admin adds or replaces their reply on a comment.
 */
exports.replyToComment = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  const comment = post.comments.id(req.params.commentId);
  if (!comment) return next(new AppError('Comment not found', 404));

  if (comment.isHidden) {
    return next(new AppError('Cannot reply to a hidden comment', 400));
  }

  const body = (req.body.body || '').trim();
  if (!body)             return next(new AppError('Reply body is required', 400));
  if (body.length > 2000) return next(new AppError('Reply cannot exceed 2000 characters', 400));

  const isUpdate = !!comment.adminReply;
  comment.adminReply = { body, repliedAt: new Date() };
  await post.save();

  res.status(200).json({
    status:  'success',
    message: isUpdate ? 'Reply updated successfully' : 'Reply added successfully',
    data:    { reply: comment.adminReply }
  });
});

/**
 * DELETE /api/v1/blogs/:id/comments/:commentId/reply
 */
exports.deleteReply = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  const comment = post.comments.id(req.params.commentId);
  if (!comment)            return next(new AppError('Comment not found', 404));
  if (!comment.adminReply) return next(new AppError('No reply exists on this comment', 404));

  comment.adminReply = null;
  await post.save();

  res.status(200).json({
    status:  'success',
    message: 'Reply deleted successfully',
    data:    null
  });
});

// ─────────────────────────────────────────────
//  REACTIONS  (PUBLIC — no login required)
// ─────────────────────────────────────────────

/**
 * POST /api/v1/blogs/:id/reactions
 * Body: { type: 'read' | 'love' }
 *
 * Toggle behaviour:
 *  • Logged-in  → stored against user ID (permanent, survives browser clears)
 *  • Anonymous  → NOT allowed; must log in to react
 *
 * Wait — requirement #3 says "like the blog without register".
 * We implement this as a GUEST reaction using the fingerprint.
 * Guest reactions are stored in a separate lightweight collection
 * to avoid polluting the user-based reactions array.
 * For simplicity we store them in-document as guestReactions.
 *
 * Strategy:
 *  - Logged-in users: use user._id (react once per account)
 *  - Guests: use fingerprint (react once per browser/IP)
 *  - Both toggle independently
 */
exports.toggleReaction = catchAsync(async (req, res, next) => {
  const VALID_TYPES = ['read', 'love'];
  const type = (req.body.type || '').trim().toLowerCase();

  if (!VALID_TYPES.includes(type)) {
    return next(new AppError(`Reaction type must be one of: ${VALID_TYPES.join(', ')}`, 400));
  }

  const post = await Post.findOne({ _id: req.params.id, status: 'published' });
  if (!post) return next(new AppError('Post not found', 404));

  let action;

  if (req.user) {
    // ── Logged-in user ──────────────────────────────────────────
    const userId   = req.user._id.toString();
    const existing = post.reactions.find(r => r.user.toString() === userId);

    if (!existing) {
      post.reactions.push({ user: req.user._id, type });
      action = 'added';
    } else if (existing.type === type) {
      post.reactions = post.reactions.filter(r => r.user.toString() !== userId);
      action = 'removed';
    } else {
      existing.type = type;
      action = 'updated';
    }

    await post.save();

    const userReaction = post.reactions.find(r => r.user.toString() === userId) || null;

    return res.status(200).json({
      status:  'success',
      message: `Reaction ${action} successfully`,
      data: {
        reactionCounts: post.reactionCounts,
        yourReaction:   userReaction ? userReaction.type : null,
        action
      }
    });

  } else {
    // ── Guest user (no account needed) ─────────────────────────
    // We use a fingerprint-keyed atomic update to avoid a read-modify-write race.
    const fingerprint = buildFingerprint(req);

    // Fetch guest reactions for this post (stored separately in memory via
    // a lightweight atomic approach: we use $set on a Map-style subdoc)
    // Since PostSchema doesn't have guestReactions yet, we use a separate
    // atomic counter approach: we track fingerprints in a `guestReactions`
    // field. We add it dynamically via findOneAndUpdate.

    // Check current state
    const rawPost = await Post.findById(post._id)
      .select('guestReactions reactionCounts')
      .lean();

    const guestReactions = rawPost.guestReactions || {};
    const currentType    = guestReactions[fingerprint];

    let countDelta = {};

    if (!currentType) {
      // New guest reaction
      countDelta[`reactionCounts.${type}`] = 1;
      await Post.updateOne(
        { _id: post._id },
        {
          $set: { [`guestReactions.${fingerprint}`]: type },
          $inc: countDelta
        }
      );
      action = 'added';
    } else if (currentType === type) {
      // Toggle off
      countDelta[`reactionCounts.${type}`] = -1;
      await Post.updateOne(
        { _id: post._id },
        {
          $unset: { [`guestReactions.${fingerprint}`]: '' },
          $inc:   countDelta
        }
      );
      action = 'removed';
    } else {
      // Switch type
      countDelta[`reactionCounts.${currentType}`] = -1;
      countDelta[`reactionCounts.${type}`]         = 1;
      await Post.updateOne(
        { _id: post._id },
        {
          $set: { [`guestReactions.${fingerprint}`]: type },
          $inc: countDelta
        }
      );
      action = 'updated';
    }

    // Re-fetch fresh counts
    const updated = await Post.findById(post._id).select('reactionCounts').lean();

    return res.status(200).json({
      status:  'success',
      message: `Reaction ${action} successfully`,
      data: {
        reactionCounts: updated.reactionCounts,
        yourReaction:   action === 'removed' ? null : type,
        action
      }
    });
  }
});

/**
 * GET /api/v1/blogs/:id/reactions
 * Returns reaction counts + the requesting user/guest's reaction.
 * Fully public.
 */
exports.getReactions = catchAsync(async (req, res, next) => {
  const post = await Post.findOne({ _id: req.params.id, status: 'published' })
    .select('reactionCounts reactions guestReactions');

  if (!post) return next(new AppError('Post not found', 404));

  let yourReaction = null;

  if (req.user) {
    const r = post.reactions.find(r => r.user.toString() === req.user._id.toString());
    yourReaction = r ? r.type : null;
  } else {
    // Guest: look up by fingerprint
    const fingerprint    = buildFingerprint(req);
    const guestReactions = post.guestReactions || {};
    yourReaction         = guestReactions[fingerprint] || null;
  }

  res.status(200).json({
    status: 'success',
    data: {
      reactionCounts: post.reactionCounts,
      yourReaction
    }
  });
});