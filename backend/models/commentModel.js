'use strict';

// models/commentModel.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

const COMMENT_MAX_LENGTH = 2000;

const CommentSchema = new Schema(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: [true, 'Comment must belong to a post'],
      index: true
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment must have an author'],
      index: true
    },

    body: {
      type: String,
      required: [true, 'Comment body is required'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [COMMENT_MAX_LENGTH, `Comment cannot exceed ${COMMENT_MAX_LENGTH} characters`]
    },

    // Soft-hide: hidden from public, still visible to admins
    isHidden: {
      type: Boolean,
      default: false,
      index: true
    },

    // Soft-delete: never returned in queries after deletion
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// ── Compound indexes ──
CommentSchema.index({ post: 1, createdAt: -1 });
CommentSchema.index({ post: 1, isHidden: 1, isDeleted: 1 });

// ── Auto-exclude soft-deleted comments from ALL find queries ──
CommentSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});

const Comment = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);

module.exports = Comment;