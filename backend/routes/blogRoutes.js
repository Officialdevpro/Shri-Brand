'use strict';

// routes/postRoutes.js

const express = require('express');
const { protect, restrictTo } = require('../controllers/authController');
const postController = require('../controllers/blogController');
const validateObjectId = require('../middlewares/validateObjectId');
const {
  validateCreatePost,
  validateUpdatePost,
  validateCreateComment,
  validateUpdateComment
} = require('../middlewares/validateBlog');

const router = express.Router();

// ─────────────────────────────────────────────
//  POST ROUTES
// ─────────────────────────────────────────────

// ── PUBLIC ───────────────────────────────────

// GET  /api/v1/posts              → list all published posts (paginated + filterable)
// GET  /api/v1/posts?search=...   → full-text search
// GET  /api/v1/posts?category=... → filter by category
// GET  /api/v1/posts?tag=...      → filter by tag
// GET  /api/v1/posts?featured=true → featured posts
// GET  /api/v1/posts?page=1&limit=10&sortBy=publishDate&order=desc
//
// Admin extras: ?status=draft|published|archived
router.get('/', postController.getAllPosts);

// GET /api/v1/posts/slug/:slug  — must come BEFORE /:id to avoid collision
router.get('/slug/:slug', postController.getPostBySlug);

// GET /api/v1/posts/:id
router.get('/:id', validateObjectId('id'), postController.getPost);

// ── ADMIN ONLY ───────────────────────────────

// POST /api/v1/posts
router.post(
  '/',
  validateCreatePost,
  postController.createPost
);

// PATCH /api/v1/posts/:id
router.patch(
  '/:id',
  validateObjectId('id'),
  validateUpdatePost,
  postController.updatePost
);

// PATCH /api/v1/posts/:id/publish
router.patch(
  '/:id/publish',
  validateObjectId('id'),
  postController.publishPost
);

// PATCH /api/v1/posts/:id/archive
router.patch(
  '/:id/archive',
  validateObjectId('id'),
  postController.archivePost
);

// DELETE /api/v1/posts/:id
router.delete(
  '/:id',
  validateObjectId('id'),
  postController.deletePost
);

// ─────────────────────────────────────────────
//  COMMENT ROUTES  (/api/v1/posts/:id/comments)
// ─────────────────────────────────────────────

// ── PUBLIC ───────────────────────────────────

// GET /api/v1/posts/:id/comments
// Works only if post exists, is published, and has allowComments: true.
// Admins see hidden comments too (protect is optional here — handled in controller).
router.get(
  '/:id/comments',
  validateObjectId('id'),
  postController.getComments
);

// ── PROTECTED (logged-in users) ──────────────

// POST /api/v1/posts/:id/comments
// User must be logged in. Blocked if allowComments: false.
router.post(
  '/:id/comments',
  protect,
  validateObjectId('id'),
  validateCreateComment,
  postController.createComment
);

// PATCH /api/v1/posts/:id/comments/:commentId
// Only the comment's author can update their own comment.
router.patch(
  '/:id/comments/:commentId',
  protect,
  validateObjectId('id'),
  validateObjectId('commentId'),
  validateUpdateComment,
  postController.updateComment
);

// DELETE /api/v1/posts/:id/comments/:commentId
// Author can delete their own; admin can delete any.
router.delete(
  '/:id/comments/:commentId',
  protect,
  validateObjectId('id'),
  validateObjectId('commentId'),
  postController.deleteComment
);

// ── ADMIN ONLY — comment moderation ──────────

// PATCH /api/v1/posts/:id/comments/:commentId/hide
router.patch(
  '/:id/comments/:commentId/hide',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  validateObjectId('commentId'),
  postController.hideComment
);

// PATCH /api/v1/posts/:id/comments/:commentId/unhide
router.patch(
  '/:id/comments/:commentId/unhide',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  validateObjectId('commentId'),
  postController.unhideComment
);

module.exports = router;