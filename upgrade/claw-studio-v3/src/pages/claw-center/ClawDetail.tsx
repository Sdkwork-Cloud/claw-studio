import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, Star, ShieldCheck, Mail, Globe, Calendar, MessageSquare, CheckCircle2, ChevronRight, X, Send, Paperclip, Package, Info } from 'lucide-react';
import { clawService, ClawDetail as ClawDetailType, PhysicalProduct, AuctionProduct, RechargeProduct, ContentProduct, AIGenerationProduct, ServiceProduct } from '../../services/clawService';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  PhysicalProductCard, 
  AuctionProductCard, 
  RechargeProductCard, 
  ContentProductCard, 
  AIGenerationProductCard, 
  ServiceProductCard,
  CouponProductCard,
  FoodProductCard
} from './components/products';

import { clawChatService, ChatMessage } from '../../services/clawChatService';

// --- Main Component ---

export function ClawDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claw, setClaw] = useState<ClawDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'about' | 'reviews'>('products');
  const { t } = useTranslation();

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
            const initialMsgs = await clawChatService.getInitialMessages(id, t('clawDetail.chat.welcome', 'Hello! Welcome to our storefront. How can we help you today?'));
            setMessages(initialMsgs);
          }
        }
      } catch (error) {
        console.error('Failed to fetch claw details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClaw();
  }, [id, t]);

  const sendMessage = async () => {
    if (!inputValue.trim() || !id) return;
    const userMsgText = inputValue;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMsgText,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
    setMessages(prev => [...prev, newMsg]);
    setInputValue('');
    
    setIsTyping(true);
    try {
      const responseMsg = await clawChatService.sendMessage(id, userMsgText);
      // Override text with translation if needed, or let service handle it
      responseMsg.text = t('clawDetail.chat.autoReply', 'Thanks for reaching out! Let me check our availability and get right back to you. Do you have any specific requirements?');
      setMessages(prev => [...prev, responseMsg]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleContact = () => {
    setIsChatOpen(true);
  };

  const handleRequestService = async (serviceName: string) => {
    setIsChatOpen(true);
    if (!id) return;
    const userMsgText = `${t('clawDetail.chat.inquirePrefix', "Hi, I'm interested in")} "${serviceName}".`;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMsgText,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
    setMessages(prev => [...prev, newMsg]);
    
    setIsTyping(true);
    try {
      const responseMsg = await clawChatService.sendMessage(id, userMsgText);
      responseMsg.text = t('clawDetail.chat.autoReply', 'Thanks for reaching out! Let me check our availability and get right back to you. Do you have any specific requirements?');
      setMessages(prev => [...prev, responseMsg]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsTyping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!claw) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">{t('clawDetail.notFound.title', 'Provider Not Found')}</h2>
        <button onClick={() => navigate('/claw-center')} className="text-primary-600 dark:text-primary-400 hover:underline">
          {t('clawDetail.notFound.back', 'Return to Marketplace')}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-50 dark:bg-zinc-950 pb-12 overflow-y-auto scrollbar-hide">
      {/* Header / Banner */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <button 
            onClick={() => navigate('/claw-center')}
            className="flex items-center gap-2 text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-8 font-medium text-sm w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('clawDetail.back', 'Back to Marketplace')}
          </button>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <img src={claw.logo} alt={claw.name} className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 object-cover shrink-0" referrerPolicy="no-referrer" />
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{claw.name}</h1>
                  {claw.verified && (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t('clawDetail.verified', 'Verified')}
                    </span>
                  )}
                </div>
                <p className="text-lg text-zinc-500 dark:text-zinc-400 mb-4 max-w-2xl">{claw.description}</p>
                
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {claw.location}</span>
                  <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-400 fill-amber-400" /> {claw.rating} {t('clawDetail.rating', 'Rating')}</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {claw.completedOrders.toLocaleString()}+ {t('clawDetail.orders', 'Orders')}</span>
                  <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> {claw.responseRate} {t('clawDetail.responseRate', 'Response Rate')}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 min-w-[200px] shrink-0">
              <button 
                onClick={handleContact}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-sm shadow-primary-500/20 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                {t('clawDetail.chatNow', 'Chat Now')}
              </button>
              <button 
                onClick={() => window.open(claw.website, '_blank')}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-6 py-3 rounded-xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Globe className="w-4 h-4" />
                {t('clawDetail.visitWebsite', 'Visit Website')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800">
            <button 
              onClick={() => setActiveTab('products')}
              className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'products' ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              <span className="flex items-center gap-2"><Package className="w-4 h-4" /> {t('clawDetail.tabs.products', 'Products & Services')}</span>
              {activeTab === 'products' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />}
            </button>
            <button 
              onClick={() => setActiveTab('about')}
              className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'about' ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              <span className="flex items-center gap-2"><Info className="w-4 h-4" /> {t('clawDetail.tabs.about', 'About Company')}</span>
              {activeTab === 'about' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />}
            </button>
            <button 
              onClick={() => setActiveTab('reviews')}
              className={`pb-4 text-sm font-bold transition-colors relative ${activeTab === 'reviews' ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              <span className="flex items-center gap-2"><Star className="w-4 h-4" /> {t('clawDetail.tabs.reviews', 'Reviews')} ({claw.reviews.length})</span>
              {activeTab === 'reviews' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />}
            </button>
          </div>

          {/* Tab Content */}
          <div className="pt-4">
            <AnimatePresence mode="wait">
              {activeTab === 'products' && (
                <motion.div key="products" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  {claw.products.map(product => {
                    switch (product.type) {
                      case 'physical': return <PhysicalProductCard key={product.id} product={product as PhysicalProduct} onRequest={handleRequestService} />;
                      case 'auction': return <AuctionProductCard key={product.id} product={product as AuctionProduct} onRequest={handleRequestService} />;
                      case 'recharge': return <RechargeProductCard key={product.id} product={product as RechargeProduct} onRequest={handleRequestService} />;
                      case 'content': return <ContentProductCard key={product.id} product={product as ContentProduct} onRequest={handleRequestService} />;
                      case 'ai_image':
                      case 'ai_video':
                      case 'ai_music': return <AIGenerationProductCard key={product.id} product={product as AIGenerationProduct} onRequest={handleRequestService} />;
                      case 'service': return <ServiceProductCard key={product.id} product={product as ServiceProduct} onRequest={handleRequestService} />;
                      case 'coupon': return <CouponProductCard key={product.id} product={product as any} onRequest={handleRequestService} />;
                      case 'food': return <FoodProductCard key={product.id} product={product as any} onRequest={handleRequestService} />;
                      default: return null;
                    }
                  })}
                </motion.div>
              )}

              {activeTab === 'about' && (
                <motion.div key="about" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary-500" />
                      {t('clawDetail.about.title', 'Company Overview')}
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6 whitespace-pre-line">
                      {claw.about}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {claw.tags.map(tag => (
                        <span key={tag} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}

              {activeTab === 'reviews' && (
                <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  {claw.reviews.length > 0 ? claw.reviews.map(review => (
                    <div key={review.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <img src={review.avatar} alt={review.user} className="w-10 h-10 rounded-full object-cover" />
                          <div>
                            <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{review.user}</div>
                            <div className="text-xs text-zinc-500">{new Date(review.date).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-300 dark:text-zinc-700'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm">{review.content}</p>
                    </div>
                  )) : (
                    <div className="text-center py-12 text-zinc-500">{t('clawDetail.reviews.empty', 'No reviews yet.')}</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-4">{t('clawDetail.details.title', 'Provider Details')}</h3>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-2"><Calendar className="w-4 h-4" /> {t('clawDetail.details.established', 'Established')}</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{claw.established}</dd>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-2"><MapPin className="w-4 h-4" /> {t('clawDetail.details.location', 'Location')}</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100 text-right">{claw.location}</dd>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> {t('clawDetail.responseRate', 'Response Rate')}</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{claw.responseRate}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-2"><Mail className="w-4 h-4" /> {t('clawDetail.details.email', 'Email')}</dt>
                <dd className="font-medium text-primary-600 dark:text-primary-400 truncate max-w-[150px]">{claw.contactEmail}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-primary-50 dark:bg-primary-500/5 border border-primary-100 dark:border-primary-500/10 rounded-2xl p-6">
            <h3 className="font-bold text-primary-900 dark:text-primary-100 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary-500" />
              {t('clawDetail.secure.title', 'Secure Transaction')}
            </h3>
            <p className="text-sm text-primary-700 dark:text-primary-300/80 leading-relaxed">
              {t('clawDetail.secure.desc', 'All transactions and service agreements made through Claw Mall are protected by our platform guarantee. Payments are held in escrow until service delivery is confirmed.')}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Drawer */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%', opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.5 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white dark:bg-zinc-900 shadow-2xl border-l border-zinc-200 dark:border-zinc-800 z-50 flex flex-col"
            >
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
                 <div className="flex items-center gap-3">
                   <div className="relative">
                     <img src={claw.logo} alt={claw.name} className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
                     <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full"></div>
                   </div>
                   <div>
                     <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{claw.name}</h3>
                     <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('clawDetail.chat.repliesIn', 'Typically replies in minutes')}</p>
                   </div>
                 </div>
                 <button onClick={() => setIsChatOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                   <X className="w-5 h-5" />
                 </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/50">
                 {messages.map(msg => (
                   <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                     <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                       msg.sender === 'user' 
                         ? 'bg-primary-600 text-white rounded-tr-sm' 
                         : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-tl-sm shadow-sm'
                     }`}>
                       {msg.text}
                     </div>
                     <span className="text-[10px] text-zinc-400 mt-1">{msg.time}</span>
                   </div>
                 ))}
                 {isTyping && (
                   <div className="flex items-start">
                     <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1 shadow-sm">
                       <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                       <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                       <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                     </div>
                   </div>
                 )}
                 <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                 <div className="flex items-center gap-2">
                   <button className="p-2 text-zinc-400 hover:text-primary-600 transition-colors">
                     <Paperclip className="w-5 h-5" />
                   </button>
                   <input 
                     type="text" 
                     value={inputValue}
                     onChange={e => setInputValue(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && sendMessage()}
                     placeholder={t('clawDetail.chat.placeholder', 'Type your inquiry...')}
                     className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/50 outline-none dark:text-zinc-100"
                   />
                   <button 
                     onClick={sendMessage}
                     disabled={!inputValue.trim()}
                     className="p-2.5 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                   >
                     <Send className="w-4 h-4" />
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
