'use strict';

// controllers/postController.js

const Post    = require('../models/blogModel');
const Comment = require('../models/commentModel');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');

// ─────────────────────────────────────────────
//  PRIVATE HELPERS
// ─────────────────────────────────────────────

/**
 * Build a MongoDB filter from query-string params.
 * Public users can only see published posts.
 * Admins may additionally filter by any status.
 */
const buildPostFilter = (query, isAdmin = false) => {
  const filter = {};

  if (!isAdmin) {
    filter.status = 'published';
  } else if (query.status) {
    filter.status = query.status;
  }

  if (query.category)  filter.category               = query.category;
  if (query.tag)       filter.tags                   = query.tag;
  if (query.author)    filter.author                 = query.author;
  if (query.featured !== undefined) {
    filter['settings.isFeatured'] = query.featured === 'true';
  }

  return filter;
};

/**
 * Parse + clamp pagination params.
 * Max limit = 50 to prevent accidental full-collection dumps.
 */
const parsePagination = (query) => {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip  = (page - 1) * limit;

  const ALLOWED_SORT = ['publishDate', 'createdAt', 'title', 'updatedAt'];
  const sortField    = ALLOWED_SORT.includes(query.sortBy) ? query.sortBy : 'publishDate';
  const sortOrder    = query.order === 'asc' ? 1 : -1;

  return { page, limit, skip, sort: { [sortField]: sortOrder } };
};

// ─────────────────────────────────────────────
//  POST — PUBLIC ROUTES
// ─────────────────────────────────────────────

// ==================== GET ALL POSTS ====================
// GET /api/v1/posts
// Public → published only.  Admin → all statuses + extra filters.
// Supports: ?search, ?category, ?tag, ?author, ?featured,
//           ?status (admin), ?page, ?limit, ?sortBy, ?order

exports.getAllPosts = catchAsync(async (req, res, next) => {
  const isAdmin = req.user && req.user.role === 'admin';
  const { page, limit, skip, sort } = parsePagination(req.query);

  // ── Full-text search (MongoDB text index) ──
  if (req.query.search) {
    if (!req.query.search.trim()) {
      return next(new AppError('Search query cannot be empty', 400));
    }

    const posts = await Post.search(req.query.search.trim(), { limit });

    return res.status(200).json({
      status:  'success',
      results: posts.length,
      data:    { posts }
    });
  }

  const filter = buildPostFilter(req.query, isAdmin);

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-search_text')
      .lean(),
    Post.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    status:  'success',
    results: posts.length,
    pagination: {
      total,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: { posts }
  });
});

// ==================== GET SINGLE POST BY ID ====================
// GET /api/v1/posts/:id
// Public → published only.  Admin → any status.

exports.getPost = catchAsync(async (req, res, next) => {
  const isAdmin = req.user && req.user.role === 'admin';
  const filter  = { _id: req.params.id };

  if (!isAdmin) filter.status = 'published';

  const post = await Post.findOne(filter).select('-search_text').lean();

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data:   { post }
  });
});

// ==================== GET SINGLE POST BY SLUG ====================
// GET /api/v1/posts/slug/:slug
// Public → published only.  Admin → any status.

exports.getPostBySlug = catchAsync(async (req, res, next) => {
  const isAdmin = req.user && req.user.role === 'admin';
  const filter  = { slug: req.params.slug.toLowerCase().trim() };

  if (!isAdmin) filter.status = 'published';

  const post = await Post.findOne(filter).select('-search_text').lean();

  if (!post) {
    return next(new AppError('No post found with that slug', 404));
  }

  res.status(200).json({
    status: 'success',
    data:   { post }
  });
});

// ─────────────────────────────────────────────
//  POST — ADMIN ONLY ROUTES
// ─────────────────────────────────────────────

// ==================== CREATE POST ====================
// POST /api/v1/posts   (admin only)

exports.createPost = catchAsync(async (req, res, next) => {
  const post = await Post.create(req.body);

  res.status(201).json({
    status:  'success',
    message: 'Post created successfully',
    data:    { post }
  });
});

// ==================== UPDATE POST ====================
// PATCH /api/v1/posts/:id   (admin only)
// Uses .save() so ALL pre-save hooks (slug, rendered_html, stats) run.

exports.updatePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  const UPDATABLE = [
    'title', 'subtitle', 'slug', 'blocks',
    'coverImage', 'category', 'tags',
    'author', 'publishDate', 'readTime',
    'settings', 'status'
  ];

  UPDATABLE.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      post[field] = req.body[field];
    }
  });

  await post.save();

  res.status(200).json({
    status:  'success',
    message: 'Post updated successfully',
    data:    { post }
  });
});

// ==================== PUBLISH POST ====================
// PATCH /api/v1/posts/:id/publish   (admin only)

exports.publishPost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  if (post.status === 'published') {
    return next(new AppError('Post is already published', 400));
  }

  await post.publish(); // instance method handles status + publishDate + save()

  res.status(200).json({
    status:  'success',
    message: 'Post published successfully',
    data:    { post }
  });
});

// ==================== ARCHIVE POST ====================
// PATCH /api/v1/posts/:id/archive   (admin only)

exports.archivePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  if (post.status === 'archived') {
    return next(new AppError('Post is already archived', 400));
  }

  await post.archive(); // instance method handles status + save()

  res.status(200).json({
    status:  'success',
    message: 'Post archived successfully',
    data:    { post }
  });
});

// ==================== DELETE POST ====================
// DELETE /api/v1/posts/:id   (admin only)
// Permanently deletes the post AND all its comments atomically.

exports.deletePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  // Delete post + comments in parallel
  await Promise.all([
    Post.findByIdAndDelete(req.params.id),
    Comment.deleteMany({ post: req.params.id })
  ]);

  res.status(204).json({
    status: 'success',
    data:   null
  });
});

// ─────────────────────────────────────────────
//  COMMENT ROUTES
// ─────────────────────────────────────────────

// ==================== GET COMMENTS ====================
// GET /api/v1/posts/:id/comments
// Public (if comments enabled on post).
// Admin can see hidden comments too.

exports.getComments = catchAsync(async (req, res, next) => {
  const isAdmin = req.user && req.user.role === 'admin';

  // 1) Verify post exists (public: must be published, admin: any status)
  const postFilter = { _id: req.params.id };
  if (!isAdmin) postFilter.status = 'published';

  const post = await Post
    .findOne(postFilter)
    .select('settings.allowComments')
    .lean();

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  // 2) Comments enabled check (admin always bypasses)
  if (!isAdmin && !post.settings.allowComments) {
    return next(new AppError('Comments are disabled for this post', 403));
  }

  const { page, limit, skip } = parsePagination(req.query);

  // 3) Admin sees hidden comments; public does not
  const commentFilter = { post: req.params.id };
  if (!isAdmin) commentFilter.isHidden = false;

  const [comments, total] = await Promise.all([
    Comment.find(commentFilter)
      .populate('author', 'name email')  // only expose safe user fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Comment.countDocuments(commentFilter)
  ]);

  res.status(200).json({
    status:  'success',
    results: comments.length,
    pagination: {
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    },
    data: { comments }
  });
});

// ==================== CREATE COMMENT ====================
// POST /api/v1/posts/:id/comments
// Protected — user must be logged in (JWT verified via protect middleware).
// Blocked if post doesn't exist, isn't published, or has allowComments: false.

exports.createComment = catchAsync(async (req, res, next) => {
  // 1) Post must be published (comments are public-facing feature)
  const post = await Post
    .findOne({ _id: req.params.id, status: 'published' })
    .select('settings.allowComments')
    .lean();

  if (!post) {
    return next(new AppError('No published post found with that ID', 404));
  }

  // 2) Check comments are enabled for this specific post
  if (!post.settings.allowComments) {
    return next(new AppError('Comments are disabled for this post', 403));
  }

  // 3) Create — body already validated & sanitised by validateCreateComment middleware
  const comment = await Comment.create({
    post:   req.params.id,
    author: req.user._id,
    body:   req.body.body
  });

  // 4) Populate author fields for the response
  await comment.populate('author', 'name email');

  res.status(201).json({
    status:  'success',
    message: 'Comment added successfully',
    data:    { comment }
  });
});

// ==================== UPDATE COMMENT ====================
// PATCH /api/v1/posts/:id/comments/:commentId
// Protected — only the comment's own author can edit their comment.

exports.updateComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.commentId);

  if (!comment) {
    return next(new AppError('No comment found with that ID', 404));
  }

  // Guard: comment must actually belong to this post
  if (comment.post.toString() !== req.params.id) {
    return next(new AppError('Comment does not belong to this post', 400));
  }

  // Guard: only the original author can edit (admins cannot rewrite user comments)
  if (comment.author.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not have permission to edit this comment', 403));
  }

  comment.body = req.body.body; // validated + sanitised by validateUpdateComment
  await comment.save();

  await comment.populate('author', 'name email');

  res.status(200).json({
    status:  'success',
    message: 'Comment updated successfully',
    data:    { comment }
  });
});

// ==================== DELETE COMMENT ====================
// DELETE /api/v1/posts/:id/comments/:commentId
// Protected — author can delete their own; admin can delete any.

exports.deleteComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.commentId);

  if (!comment) {
    return next(new AppError('No comment found with that ID', 404));
  }

  // Guard: comment must belong to this post
  if (comment.post.toString() !== req.params.id) {
    return next(new AppError('Comment does not belong to this post', 400));
  }

  const isAdmin  = req.user.role === 'admin';
  const isAuthor = comment.author.toString() === req.user._id.toString();

  if (!isAdmin && !isAuthor) {
    return next(new AppError('You do not have permission to delete this comment', 403));
  }

  // Soft-delete so the pre-find hook handles the rest
  comment.isDeleted = true;
  await comment.save({ validateBeforeSave: false });

  res.status(204).json({
    status: 'success',
    data:   null
  });
});

// ==================== HIDE COMMENT (ADMIN) ====================
// PATCH /api/v1/posts/:id/comments/:commentId/hide
// Admin only — hide a comment from public view without permanently deleting it.

exports.hideComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.commentId);

  if (!comment) {
    return next(new AppError('No comment found with that ID', 404));
  }

  if (comment.post.toString() !== req.params.id) {
    return next(new AppError('Comment does not belong to this post', 400));
  }

  comment.isHidden = true;
  await comment.save({ validateBeforeSave: false });

  res.status(200).json({
    status:  'success',
    message: 'Comment hidden successfully',
    data:    { comment }
  });
});

// ==================== UNHIDE COMMENT (ADMIN) ====================
// PATCH /api/v1/posts/:id/comments/:commentId/unhide
// Admin only — restore a previously hidden comment.

exports.unhideComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.commentId);

  if (!comment) {
    return next(new AppError('No comment found with that ID', 404));
  }

  if (comment.post.toString() !== req.params.id) {
    return next(new AppError('Comment does not belong to this post', 400));
  }

  comment.isHidden = false;
  await comment.save({ validateBeforeSave: false });

  res.status(200).json({
    status:  'success',
    message: 'Comment restored successfully',
    data:    { comment }
  });
});

module.exports = exports;