'use strict';

// models/commentModel.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─────────────────────────────────────────────
//  COMMENT SCHEMA
// ─────────────────────────────────────────────
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
      required: [true, 'Comment must have an author']
    },
    body: {
      type: String,
      required: [true, 'Comment body is required'],
      trim: true,
      minlength: [1,    'Comment cannot be empty'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    // Soft-delete — preserves history, hidden from all find() via pre-hook
    isDeleted: {
      type: Boolean,
      default: false,
      select: false   // never returned in normal queries
    },
    // Admin can hide without deleting
    isHidden: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ── Indexes ───────────────────────────────────
CommentSchema.index({ post: 1, createdAt: -1 });
CommentSchema.index({ author: 1 });

// ── Auto-exclude soft-deleted docs from ALL find queries ──
CommentSchema.pre(/^find/, function () {
  this.find({ isDeleted: { $ne: true } });
});

const Comment = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);

module.exports = Comment;