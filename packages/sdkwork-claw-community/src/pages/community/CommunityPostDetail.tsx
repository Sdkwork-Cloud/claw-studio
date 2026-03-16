import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Heart, Share2, Bookmark, MoreHorizontal, Clock, Eye, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { communityService, CommunityPost, CommunityComment } from '../../services';

import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export function CommunityPostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPostData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [postData, commentsData] = await Promise.all([
          communityService.getPost(id),
          communityService.getComments(id)
        ]);
        setPost(postData);
        setComments(commentsData);
      } catch (error) {
        console.error('Failed to fetch post details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPostData();
  }, [id]);

  const handleLike = async () => {
    if (!post) return;
    setIsLiked(!isLiked);
    await communityService.likePost(post.id);
  };

  const handleBookmark = async () => {
    if (!post) return;
    setIsBookmarked(!isBookmarked);
    await communityService.bookmarkPost(post.id);
  };

  const handleAddComment = async () => {
    if (!post || !commentText.trim()) return;
    try {
      const newComment = await communityService.addComment(post.id, commentText);
      setComments([...comments, newComment]);
      setCommentText('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Post not found</h2>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-primary-600 text-white rounded-xl font-bold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors font-medium text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Community
        </button>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsBookmarked(!isBookmarked)}
            className={`p-2 rounded-full transition-colors ${isBookmarked ? 'text-primary-500 bg-primary-50 dark:bg-primary-500/10' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
          <button className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto pb-24">
        {/* Cover Image */}
        {post.coverImage && (
          <div className="w-full h-64 md:h-96 relative">
            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 dark:from-zinc-950 to-transparent" />
          </div>
        )}

        <div className="px-6 md:px-12 -mt-20 relative z-10">
          {/* Article Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 bg-primary-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                {post.category}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <Clock className="w-4 h-4" /> {post.createdAt}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <Eye className="w-4 h-4" /> {post.stats.views.toLocaleString()} views
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-100 leading-tight mb-8 tracking-tight">
              {post.title}
            </h1>

            <div className="flex items-center justify-between py-6 border-y border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-4">
                <img src={post.author.avatar} alt={post.author.name} className="w-12 h-12 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm" referrerPolicy="no-referrer" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{post.author.name}</h3>
                    {post.author.role === 'Official' || post.author.role === 'Core Contributor' ? (
                      <span className="px-1.5 py-0.5 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[10px] font-bold uppercase rounded">
                        {post.author.role}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{post.author.bio}</p>
                </div>
              </div>
              <button className="px-5 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full text-sm font-bold hover:bg-zinc-800 dark:hover:bg-white transition-colors shadow-sm">
                Follow
              </button>
            </div>
          </div>

          {/* Article Content */}
          <div className="prose prose-zinc dark:prose-invert prose-lg max-w-none mb-12 prose-headings:font-bold prose-a:text-primary-500 prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-img:rounded-2xl">
            <Markdown
              rehypePlugins={[rehypeRaw]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus as any}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {post.content}
            </Markdown>
          </div>

          {/* Tags & Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-8 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2">
              {post.tags.map(tag => (
                <span key={tag} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-medium rounded-lg">
                  #{tag}
                </span>
              ))}
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={handleLike}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-colors ${
                  isLiked 
                    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                {post.stats.likes + (isLiked ? 1 : 0)}
              </button>
            </div>
          </div>

          {/* Comments Section */}
          <div className="mt-12">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-8 flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              Comments ({comments.length})
            </h3>

            {/* Comment Input */}
            <div className="flex gap-4 mb-10">
              <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold shrink-0">
                ME
              </div>
              <div className="flex-1 relative">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add to the discussion..."
                  className="w-full bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 resize-none min-h-[100px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
                />
                <button 
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="absolute bottom-3 right-3 p-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:hover:bg-primary-500 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-8">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-4">
                  <img src={comment.author.avatar} alt={comment.author.name} className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-800" referrerPolicy="no-referrer" />
                  <div className="flex-1">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{comment.author.name}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{comment.createdAt}</span>
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 mt-2 ml-2">
                      <button className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-primary-500 transition-colors">
                        <Heart className="w-3.5 h-3.5" /> {comment.likes}
                      </button>
                      <button className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
