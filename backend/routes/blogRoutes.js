'use strict';

// routes/blogRoutes.js

const express          = require('express');
const { protect, restrictTo } = require('../controllers/authController');
const postController   = require('../controllers/blogController');
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

router.get('/', postController.getAllPosts);

// MUST come BEFORE /:id
router.get('/slug/:slug', postController.getPostBySlug);

router.get('/:id', validateObjectId('id'), postController.getPost);

// ── ADMIN ONLY ───────────────────────────────

router.post(
  '/',
  protect,
  restrictTo('admin'),
  validateCreatePost,
  postController.createPost
);

router.patch(
  '/:id',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  validateUpdatePost,
  postController.updatePost
);

router.patch(
  '/:id/publish',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  postController.publishPost
);

router.patch(
  '/:id/archive',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  postController.archivePost
);

router.delete(
  '/:id',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  postController.deletePost
);

// ─────────────────────────────────────────────
//  REACTION ROUTES  (/api/v1/blogs/:id/reactions)
//  PUBLIC — no login required for likes/reads
// ─────────────────────────────────────────────

// GET  /api/v1/blogs/:id/reactions  — public (shows user's/guest's reaction if available)
router.get(
  '/:id/reactions',
  validateObjectId('id'),
  postController.getReactions
);

// POST /api/v1/blogs/:id/reactions  — public toggle (logged-in or guest)
// Body: { type: 'read' | 'love' }
router.post(
  '/:id/reactions',
  validateObjectId('id'),
  postController.toggleReaction
);

// ─────────────────────────────────────────────
//  COMMENT ROUTES  (/api/v1/blogs/:id/comments)
// ─────────────────────────────────────────────

// ── PUBLIC ───────────────────────────────────

router.get(
  '/:id/comments',
  validateObjectId('id'),
  postController.getComments
);

// ── REGISTERED USERS ONLY ────────────────────

// POST — create comment (must be logged in)
router.post(
  '/:id/comments',
  protect,
  validateObjectId('id'),
  validateCreateComment,
  postController.createComment
);

// PATCH — edit own comment
router.patch(
  '/:id/comments/:commentId',
  protect,
  validateObjectId('id'),
  validateObjectId('commentId'),
  validateUpdateComment,
  postController.updateComment
);

// DELETE — own comment or admin
router.delete(
  '/:id/comments/:commentId',
  protect,
  validateObjectId('id'),
  validateObjectId('commentId'),
  postController.deleteComment
);

// ── ADMIN ONLY — comment moderation ──────────

// PATCH /api/v1/blogs/:id/comments/:commentId/hide
router.patch(
  '/:id/comments/:commentId/hide',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  validateObjectId('commentId'),
  postController.hideComment
);

// PATCH /api/v1/blogs/:id/comments/:commentId/unhide
router.patch(
  '/:id/comments/:commentId/unhide',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  validateObjectId('commentId'),
  postController.unhideComment
);

// PATCH /api/v1/blogs/:id/comments/:commentId/heart  — YouTube-style creator heart
router.patch(
  '/:id/comments/:commentId/heart',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  validateObjectId('commentId'),
  postController.heartComment
);

// ── ADMIN ONLY — admin reply per comment ─────

// POST   /api/v1/blogs/:id/comments/:commentId/reply
router.post(
  '/:id/comments/:commentId/reply',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  validateObjectId('commentId'),
  postController.replyToComment
);

// DELETE /api/v1/blogs/:id/comments/:commentId/reply
router.delete(
  '/:id/comments/:commentId/reply',
  protect,
  restrictTo('admin'),
  validateObjectId('id'),
  validateObjectId('commentId'),
  postController.deleteReply
);

module.exports = router;