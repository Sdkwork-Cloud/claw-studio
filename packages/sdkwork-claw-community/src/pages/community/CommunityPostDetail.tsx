import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  Clock,
  Eye,
  Heart,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Send,
  Share2,
  Sparkles,
  Wallet,
  Wrench,
} from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatNumber } from '@sdkwork/claw-i18n';
import { Textarea } from '@sdkwork/claw-ui';
import type { CommunityComment, CommunityPost } from '../../services';
import { communityService } from '../../services';

const COMMUNITY_CATEGORY_LABEL_KEYS: Record<string, string> = {
  'job-seeking': 'community.newPost.entryTypes.jobSeeking',
  recruitment: 'community.newPost.entryTypes.recruitment',
  services: 'community.newPost.entryTypes.services',
  partnerships: 'community.newPost.entryTypes.partnerships',
  news: 'community.newPost.entryTypes.news',
};

const COMMUNITY_SERVICE_LINE_KEYS: Record<string, string> = {
  legal: 'community.postDetail.listingMeta.serviceLines.legal',
  tax: 'community.postDetail.listingMeta.serviceLines.tax',
  design: 'community.postDetail.listingMeta.serviceLines.design',
  development: 'community.postDetail.listingMeta.serviceLines.development',
  marketing: 'community.postDetail.listingMeta.serviceLines.marketing',
  translation: 'community.postDetail.listingMeta.serviceLines.translation',
  operations: 'community.postDetail.listingMeta.serviceLines.operations',
  training: 'community.postDetail.listingMeta.serviceLines.training',
  consulting: 'community.postDetail.listingMeta.serviceLines.consulting',
  content: 'community.postDetail.listingMeta.serviceLines.content',
  data: 'community.postDetail.listingMeta.serviceLines.data',
  hr: 'community.postDetail.listingMeta.serviceLines.hr',
};

const COMMUNITY_DELIVERY_MODE_KEYS: Record<string, string> = {
  online: 'community.postDetail.listingMeta.deliveryModes.online',
  hybrid: 'community.postDetail.listingMeta.deliveryModes.hybrid',
  onsite: 'community.postDetail.listingMeta.deliveryModes.onsite',
};

export function CommunityPostDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchPostData = async () => {
      if (!id) {
        return;
      }

      setLoading(true);

      try {
        const [postData, commentsData] = await Promise.all([
          communityService.getPost(id),
          communityService.getComments(id),
        ]);

        if (!active) {
          return;
        }

        setPost(postData);
        setComments(commentsData);
      } catch (error) {
        console.error('Failed to fetch post details:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchPostData();

    return () => {
      active = false;
    };
  }, [id]);

  const roleLabels = useMemo(
    () => ({
      Official: t('community.postDetail.roles.official'),
      'Core Contributor': t('community.postDetail.roles.coreContributor'),
    }),
    [t],
  );
  const formattedPostDate = useMemo(
    () =>
      post
        ? formatDate(post.createdAt, i18n.language, {
            dateStyle: 'medium',
          })
        : '',
    [i18n.language, post],
  );
  const translatedCategory = useMemo(() => {
    if (!post) {
      return '';
    }

    const translationKey = COMMUNITY_CATEGORY_LABEL_KEYS[post.category];
    return translationKey ? t(translationKey) : post.category;
  }, [post, t]);
  const isNewsEntry = post?.category === 'news';
  const listingMeta = useMemo(() => {
    if (!post) {
      return [];
    }

    return [
      post.location
        ? {
            id: 'location',
            label: t('community.postDetail.listingMeta.location'),
            value: post.location,
            icon: MapPin,
          }
        : null,
      post.compensation
        ? {
            id: 'compensation',
            label: t('community.postDetail.listingMeta.compensation'),
            value: post.compensation,
            icon: Wallet,
          }
        : null,
      post.company
        ? {
            id: 'company',
            label: t('community.postDetail.listingMeta.company'),
            value: post.company,
            icon: Building2,
          }
        : null,
      post.serviceLine
        ? {
            id: 'serviceLine',
            label: t('community.postDetail.listingMeta.serviceLine'),
            value: t(COMMUNITY_SERVICE_LINE_KEYS[post.serviceLine] ?? post.serviceLine),
            icon: Wrench,
          }
        : null,
      post.deliveryMode
        ? {
            id: 'deliveryMode',
            label: t('community.postDetail.listingMeta.deliveryMode'),
            value: t(COMMUNITY_DELIVERY_MODE_KEYS[post.deliveryMode] ?? post.deliveryMode),
            icon: Send,
          }
        : null,
      post.turnaround
        ? {
            id: 'turnaround',
            label: t('community.postDetail.listingMeta.turnaround'),
            value: post.turnaround,
            icon: Clock,
          }
        : null,
      post.employmentType
        ? {
            id: 'employmentType',
            label: t('community.postDetail.listingMeta.employmentType'),
            value: post.employmentType,
            icon: BriefcaseBusiness,
          }
        : null,
      post.publisherType
        ? {
            id: 'publisherType',
            label: t('community.postDetail.listingMeta.publisherType'),
            value: t(`community.postDetail.listingMeta.publisherTypes.${post.publisherType}`),
            icon: Sparkles,
          }
        : null,
      post.contactPreference
        ? {
            id: 'contactPreference',
            label: t('community.postDetail.listingMeta.contactPreference'),
            value: post.contactPreference,
            icon: MessageSquare,
          }
        : null,
    ].filter(Boolean) as Array<{
      id: string;
      label: string;
      value: string;
      icon: typeof MapPin;
    }>;
  }, [post, t]);

  const handleLike = async () => {
    if (!post) {
      return;
    }

    setIsLiked((previous) => !previous);
    await communityService.likePost(post.id);
  };

  const handleBookmark = async () => {
    if (!post) {
      return;
    }

    setIsBookmarked((previous) => !previous);
    await communityService.bookmarkPost(post.id);
  };

  const handleAddComment = async () => {
    if (!post || !commentText.trim()) {
      return;
    }

    try {
      const newComment = await communityService.addComment(post.id, commentText);
      setComments((previous) => [...previous, newComment]);
      setCommentText('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('community.postDetail.notFoundTitle')}
        </h2>
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl bg-primary-600 px-4 py-2 font-bold text-white"
        >
          {t('common.goBack')}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('community.postDetail.backToCommunity')}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBookmark}
            aria-label={t('community.postDetail.actions.bookmark')}
            className={`rounded-full p-2 transition-colors ${
              isBookmarked
                ? 'bg-primary-50 text-primary-500 dark:bg-primary-500/10'
                : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
          <button
            aria-label={t('community.postDetail.actions.share')}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            aria-label={t('community.postDetail.actions.more')}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl pb-24">
        {post.coverImage ? (
          <div className="relative h-64 w-full md:h-96">
            <img
              src={post.coverImage}
              alt={post.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 to-transparent dark:from-zinc-950" />
          </div>
        ) : null}

        <div className="relative z-10 -mt-20 px-6 md:px-12">
          <div className="mb-10">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                {translatedCategory}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <Clock className="h-4 w-4" />
                {formattedPostDate}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <Eye className="h-4 w-4" />
                {t('community.postDetail.meta.views', {
                  count: post.stats.views,
                })}
              </span>
            </div>

            <h1 className="mb-8 text-4xl font-black leading-tight tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">
              {post.title}
            </h1>

            <div className="flex flex-col gap-4 border-y border-zinc-200 py-6 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="h-12 w-12 rounded-full border-2 border-white shadow-sm dark:border-zinc-800"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                      {post.author.name}
                    </h3>
                    {post.author.role in roleLabels ? (
                      <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                        {roleLabels[post.author.role as keyof typeof roleLabels]}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{post.author.bio}</p>
                </div>
              </div>
              <button className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
                {t('community.postDetail.actions.follow')}
              </button>
            </div>
          </div>

          {isNewsEntry ? (
            <div className="mb-10 rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                {t('community.postDetail.newsPanelTitle')}
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {t('community.postDetail.newsPanelDescription')}
              </p>
            </div>
          ) : listingMeta.length > 0 ? (
            <div className="mb-10 rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                {t('community.postDetail.listingMeta.title')}
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {listingMeta.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        <Icon className="h-4 w-4 text-primary-500" />
                        {item.label}
                      </div>
                      <p className="mt-3 text-sm font-medium leading-6 text-zinc-900 dark:text-zinc-100">
                        {item.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="prose prose-zinc prose-lg mb-12 max-w-none prose-a:text-primary-500 prose-headings:font-bold prose-img:rounded-2xl prose-pre:border prose-pre:border-zinc-800 prose-pre:bg-zinc-900 dark:prose-invert">
            <Markdown
              rehypePlugins={[rehypeRaw]}
              components={{
                code({ inline, className, children, ...props }: any) {
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

          <div className="mb-12 rounded-3xl border border-primary-200 bg-primary-50/70 p-6 dark:border-primary-900/40 dark:bg-primary-950/20">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                  {t('community.postDetail.assistantCta.title')}
                </p>
                <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {t('community.postDetail.assistantCta.description')}
                </p>
              </div>
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700">
                <Sparkles className="h-4 w-4" />
                {t('community.postDetail.assistantCta.primaryAction')}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-6 border-t border-zinc-200 py-8 dark:border-zinc-800 sm:flex-row">
            <div className="flex flex-wrap items-center gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 rounded-full px-4 py-2 font-bold transition-colors ${
                  isLiked
                    ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                {formatNumber(post.stats.likes + (isLiked ? 1 : 0), i18n.language)}
              </button>
            </div>
          </div>

          <div className="mt-12">
            <h3 className="mb-8 flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              <MessageSquare className="h-6 w-6" />
              {t('community.postDetail.commentsTitle', {
                count: comments.length,
              })}
            </h3>

            <div className="mb-10 flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 font-bold text-white">
                {t('community.postDetail.currentUserInitials')}
              </div>
              <div className="relative flex-1">
                <Textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder={t('community.postDetail.commentPlaceholder')}
                  className="min-h-[100px] resize-none rounded-2xl bg-zinc-100 p-4 pr-12 focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-0 dark:border-zinc-700 dark:bg-zinc-800/50 dark:focus-visible:ring-offset-0"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  aria-label={t('community.postDetail.actions.sendComment')}
                  className="absolute bottom-3 right-3 rounded-xl bg-primary-500 p-2 text-white transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:hover:bg-primary-500"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-8">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-4">
                  <img
                    src={comment.author.avatar}
                    alt={comment.author.name}
                    className="h-10 w-10 rounded-full border border-zinc-200 dark:border-zinc-800"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {comment.author.name}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDate(comment.createdAt, i18n.language, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {comment.content}
                      </p>
                    </div>
                    <div className="ml-2 mt-2 flex items-center gap-4">
                      <button className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-primary-500">
                        <Heart className="h-3.5 w-3.5" />
                        {formatNumber(comment.likes, i18n.language)}
                      </button>
                      <button className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
                        {t('community.postDetail.actions.reply')}
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
