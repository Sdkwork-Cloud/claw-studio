import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Globe,
  Info,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Paperclip,
  Send,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AIGenerationProductCard,
  AuctionProductCard,
  ContentProductCard,
  CouponProductCard,
  FoodProductCard,
  PhysicalProductCard,
  RechargeProductCard,
  ServiceProductCard,
} from '../../components';
import {
  clawChatService,
  clawService,
  type AIGenerationProduct,
  type AuctionProduct,
  type ChatMessage,
  type ClawDetail as ClawDetailType,
  type ContentProduct,
  type CouponProduct,
  type FoodProduct,
  type PhysicalProduct,
  type RechargeProduct,
  type ServiceProduct,
} from '../../services';

export function ClawDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claw, setClaw] = useState<ClawDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'about' | 'reviews'>('products');
  const { t } = useTranslation();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isChatOpen]);

  useEffect(() => {
    const fetchClaw = async () => {
      setIsLoading(true);
      try {
        if (id) {
          const data = await clawService.getClawDetail(id);
          if (data) {
            setClaw(data);
            const initialMessages = await clawChatService.getInitialMessages(
              id,
              t(
                'clawDetail.chat.welcome',
                'Hello! Welcome to our storefront. How can we help you today?',
              ),
            );
            setMessages(initialMessages);
          }
        }
      } catch (error) {
        console.error('Failed to fetch claw detail:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchClaw();
  }, [id, t]);

  const sendMessage = async () => {
    if (!inputValue.trim() || !id) {
      return;
    }

    const userMessageText = inputValue;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMessageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((currentMessages) => [...currentMessages, newMessage]);
    setInputValue('');

    setIsTyping(true);
    try {
      const responseMessage = await clawChatService.sendMessage(id, userMessageText);
      responseMessage.text = t(
        'clawDetail.chat.autoReply',
        'Thanks for reaching out! Let me check our availability and get right back to you. Do you have any specific requirements?',
      );
      setMessages((currentMessages) => [...currentMessages, responseMessage]);
    } catch (error) {
      console.error('Failed to send claw detail chat message:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleContact = () => {
    setIsChatOpen(true);
  };

  const handleRequestService = async (serviceName: string) => {
    setIsChatOpen(true);
    if (!id) {
      return;
    }

    const userMessageText = `${t('clawDetail.chat.inquirePrefix', "Hi, I'm interested in")} "${serviceName}".`;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMessageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((currentMessages) => [...currentMessages, newMessage]);

    setIsTyping(true);
    try {
      const responseMessage = await clawChatService.sendMessage(id, userMessageText);
      responseMessage.text = t(
        'clawDetail.chat.autoReply',
        'Thanks for reaching out! Let me check our availability and get right back to you. Do you have any specific requirements?',
      );
      setMessages((currentMessages) => [...currentMessages, responseMessage]);
    } catch (error) {
      console.error('Failed to request claw detail service:', error);
    } finally {
      setIsTyping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex h-64 max-w-7xl items-center justify-center p-8 md:p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!claw) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center md:p-12">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('clawDetail.notFound.title', 'Provider Not Found')}
        </h2>
        <button
          onClick={() => navigate('/claw-center')}
          className="text-primary-600 hover:underline dark:text-primary-400"
        >
          {t('clawDetail.notFound.back', 'Return to Marketplace')}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 pb-12 scrollbar-hide dark:bg-zinc-950">
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-8 py-8">
          <button
            onClick={() => navigate('/claw-center')}
            className="mb-8 flex w-fit items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-primary-600 dark:hover:text-primary-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('clawDetail.back', 'Back to Marketplace')}
          </button>

          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col items-start gap-6 sm:flex-row">
              <img
                src={claw.logo}
                alt={claw.name}
                className="h-24 w-24 shrink-0 rounded-2xl border border-zinc-100 object-cover shadow-md dark:border-zinc-800 sm:h-32 sm:w-32"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                    {claw.name}
                  </h1>
                  {claw.verified && (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {t('clawDetail.verified', 'Verified')}
                    </span>
                  )}
                </div>
                <p className="mb-4 max-w-2xl text-lg text-zinc-500 dark:text-zinc-400">
                  {claw.description}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> {claw.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {claw.rating}{' '}
                    {t('clawDetail.rating', 'Rating')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />{' '}
                    {claw.completedOrders.toLocaleString()}+ {t('clawDetail.orders', 'Orders')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" /> {claw.responseRate}{' '}
                    {t('clawDetail.responseRate', 'Response Rate')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex min-w-[200px] shrink-0 flex-col gap-3">
              <button
                onClick={handleContact}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-bold text-white shadow-sm shadow-primary-500/20 transition-colors hover:bg-primary-700"
              >
                <MessageSquare className="h-4 w-4" />
                {t('clawDetail.chatNow', 'Chat Now')}
              </button>
              <button
                onClick={() => window.open(claw.website, '_blank')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3 font-bold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Globe className="h-4 w-4" />
                {t('clawDetail.visitWebsite', 'Visit Website')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-8 py-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab('products')}
              className={`relative pb-4 text-sm font-bold transition-colors ${
                activeTab === 'products'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4" /> {t('clawDetail.tabs.products', 'Products & Services')}
              </span>
              {activeTab === 'products' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`relative pb-4 text-sm font-bold transition-colors ${
                activeTab === 'about'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" /> {t('clawDetail.tabs.about', 'About Company')}
              </span>
              {activeTab === 'about' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`relative pb-4 text-sm font-bold transition-colors ${
                activeTab === 'reviews'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4" /> {t('clawDetail.tabs.reviews', 'Reviews')} (
                {claw.reviews.length})
              </span>
              {activeTab === 'reviews' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"
                />
              )}
            </button>
          </div>

          <div className="pt-4">
            <AnimatePresence mode="wait">
              {activeTab === 'products' && (
                <motion.div
                  key="products"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {claw.products.map((product) => {
                    switch (product.type) {
                      case 'physical':
                        return (
                          <PhysicalProductCard
                            key={product.id}
                            product={product as PhysicalProduct}
                            onRequest={handleRequestService}
                          />
                        );
                      case 'auction':
                        return (
                          <AuctionProductCard
                            key={product.id}
                            product={product as AuctionProduct}
                            onRequest={handleRequestService}
                          />
                        );
                      case 'recharge':
                        return (
                          <RechargeProductCard
                            key={product.id}
                            product={product as RechargeProduct}
                            onRequest={handleRequestService}
                          />
                        );
                      case 'content':
                        return (
                          <ContentProductCard
                            key={product.id}
                            product={product as ContentProduct}
                            onRequest={handleRequestService}
                          />
                        );
                      case 'ai_image':
                      case 'ai_video':
                      case 'ai_music':
                        return (
                          <AIGenerationProductCard
                            key={product.id}
                            product={product as AIGenerationProduct}
                            onRequest={handleRequestService}
                          />
                        );
                      case 'service':
                        return (
                          <ServiceProductCard
                            key={product.id}
                            product={product as ServiceProduct}
                            onRequest={handleRequestService}
                          />
                        );
                      case 'coupon':
                        return (
                          <CouponProductCard
                            key={product.id}
                            product={product as CouponProduct}
                            onRequest={handleRequestService}
                          />
                        );
                      case 'food':
                        return (
                          <FoodProductCard
                            key={product.id}
                            product={product as FoodProduct}
                            onRequest={handleRequestService}
                          />
                        );
                      default:
                        return null;
                    }
                  })}
                </motion.div>
              )}

              {activeTab === 'about' && (
                <motion.div
                  key="about"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      <Building2 className="h-5 w-5 text-primary-500" />
                      {t('clawDetail.about.title', 'Company Overview')}
                    </h2>
                    <p className="mb-6 whitespace-pre-line leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {claw.about}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {claw.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}

              {activeTab === 'reviews' && (
                <motion.div
                  key="reviews"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {claw.reviews.length > 0 ? (
                    claw.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img
                              src={review.avatar}
                              alt={review.user}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                            <div>
                              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                {review.user}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {new Date(review.date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={index}
                                className={`h-4 w-4 ${
                                  index < review.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-zinc-300 dark:text-zinc-700'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {review.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-zinc-500">
                      {t('clawDetail.reviews.empty', 'No reviews yet.')}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-4 font-bold text-zinc-900 dark:text-zinc-100">
              {t('clawDetail.details.title', 'Provider Details')}
            </h3>
            <dl className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
                <dt className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <Calendar className="h-4 w-4" />
                  {t('clawDetail.details.established', 'Established')}
                </dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                  {claw.established}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
                <dt className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <MapPin className="h-4 w-4" />
                  {t('clawDetail.details.location', 'Location')}
                </dt>
                <dd className="text-right font-medium text-zinc-900 dark:text-zinc-100">
                  {claw.location}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
                <dt className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <MessageSquare className="h-4 w-4" />
                  {t('clawDetail.responseRate', 'Response Rate')}
                </dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                  {claw.responseRate}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <Mail className="h-4 w-4" />
                  {t('clawDetail.details.email', 'Email')}
                </dt>
                <dd className="max-w-[150px] truncate font-medium text-primary-600 dark:text-primary-400">
                  {claw.contactEmail}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-primary-100 bg-primary-50 p-6 dark:border-primary-500/10 dark:bg-primary-500/5">
            <h3 className="mb-2 flex items-center gap-2 font-bold text-primary-900 dark:text-primary-100">
              <ShieldCheck className="h-5 w-5 text-primary-500" />
              {t('clawDetail.secure.title', 'Secure Transaction')}
            </h3>
            <p className="text-sm leading-relaxed text-primary-700 dark:text-primary-300/80">
              {t(
                'clawDetail.secure.desc',
                'All transactions and service agreements made through Claw Mall are protected by our platform guarantee. Payments are held in escrow until service delivery is confirmed.',
              )}
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm dark:bg-black/40"
            />
            <motion.div
              initial={{ x: '100%', opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.5 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:w-[400px]"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={claw.logo}
                      alt={claw.name}
                      className="h-10 w-10 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
                    />
                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {claw.name}
                    </h3>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {t('clawDetail.chat.repliesIn', 'Typically replies in minutes')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-zinc-50/50 p-6 dark:bg-zinc-950/50">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col ${
                      message.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        message.sender === 'user'
                          ? 'rounded-tr-sm bg-primary-600 text-white'
                          : 'rounded-tl-sm border border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                      }`}
                    >
                      {message.text}
                    </div>
                    <span className="mt-1 text-[10px] text-zinc-400">{message.time}</span>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-start">
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                      <div
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <button className="p-2 text-zinc-400 transition-colors hover:text-primary-600">
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void sendMessage();
                      }
                    }}
                    placeholder={t('clawDetail.chat.placeholder', 'Type your inquiry...')}
                    className="flex-1 rounded-full border-none bg-zinc-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/50 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <button
                    onClick={() => void sendMessage()}
                    disabled={!inputValue.trim()}
                    className="rounded-full bg-primary-600 p-2.5 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
