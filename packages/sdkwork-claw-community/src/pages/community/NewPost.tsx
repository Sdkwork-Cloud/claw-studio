import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { 
  ArrowLeft, Image as ImageIcon, Link as LinkIcon, Bold, Italic, 
  List, ListOrdered, Quote, Code, Heading1, Heading2, Loader2, 
  Sparkles, CheckSquare, Highlighter, Strikethrough, X, Send, ImagePlus,
  Upload
} from 'lucide-react';
import { communityService, llmService } from '../../services';
import { toast } from 'sonner';

const CATEGORIES = ['Tutorials', 'Discussions', 'Showcase', 'Help', 'News'];

export function NewPost() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Discussions');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // AI State
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Press '/' for commands or start typing...",
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-2xl max-w-full h-auto my-6',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary-500 underline underline-offset-4 decoration-primary-500/30 hover:decoration-primary-500 transition-colors cursor-pointer',
        },
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded-sm px-1',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-zinc dark:prose-invert prose-lg max-w-none min-h-[50vh] focus:outline-none prose-headings:font-bold prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800',
      },
    },
  });

  useEffect(() => {
    if (showAIPrompt && aiInputRef.current) {
      aiInputRef.current.focus();
    }
  }, [showAIPrompt]);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim()) && tags.length < 5) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const addImage = () => {
    const url = window.prompt('Enter image URL');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const setLink = () => {
    const previousUrl = editor?.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim() || !editor) return;
    
    setIsGenerating(true);
    try {
      const { state } = editor;
      const { selection } = state;
      const contextText = state.doc.textBetween(Math.max(0, selection.from - 1000), selection.from, '\n');
      
      const generatedText = await llmService.generateContent({
        prompt: aiPrompt,
        context: `${title ? `Title: ${title}\n` : ''}${contextText}`,
        systemInstruction: 'You are an expert technical writer helping to draft an article. Provide ONLY the requested content, formatted in Markdown. Do not include introductory or concluding remarks.'
      });
      
      if (generatedText) {
        let htmlContent = generatedText
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/gim, '<em>$1</em>')
          .replace(/\n/gim, '<br>');
          
        editor.chain().focus().insertContent(htmlContent).run();
        setShowAIPrompt(false);
        setAiPrompt('');
        toast.success('Content generated successfully');
      }
    } catch (error: any) {
      console.error('AI Generation failed:', error);
      toast.error(error.message || 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAIAction = async (action: string) => {
    if (!editor) return;
    
    setIsGenerating(true);
    try {
      const { state } = editor;
      const { selection } = state;
      
      let prompt = '';
      let context = '';
      let replaceSelection = false;

      if (!selection.empty) {
        // Text is selected
        const selectedText = state.doc.textBetween(selection.from, selection.to, '\n');
        context = selectedText;
        replaceSelection = true;
        
        if (action === 'improve') prompt = 'Improve the writing of this text. Make it more professional and engaging.';
        else if (action === 'fix') prompt = 'Fix spelling and grammar in this text.';
        else if (action === 'shorter') prompt = 'Make this text shorter and more concise.';
        else if (action === 'longer') prompt = 'Expand on this text and make it longer.';
      } else {
        // No text selected, generate from context
        const contextText = state.doc.textBetween(Math.max(0, selection.from - 1000), selection.from, '\n');
        context = `${title ? `Title: ${title}\n` : ''}${contextText}`;
        
        if (action === 'continue') prompt = 'Continue writing the article from this point.';
        else if (action === 'summarize') prompt = 'Write a brief summary of the article so far.';
      }

      const generatedText = await llmService.generateContent({
        prompt,
        context,
        systemInstruction: 'You are an expert technical writer. Provide ONLY the requested content, formatted in Markdown. Do not include introductory or concluding remarks.'
      });
      
      if (generatedText) {
        let htmlContent = generatedText
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/gim, '<em>$1</em>')
          .replace(/\n/gim, '<br>');
          
        if (replaceSelection) {
          editor.chain().focus().insertContent(htmlContent).run();
        } else {
          editor.chain().focus().insertContent(htmlContent).run();
        }
        toast.success('AI action completed');
      }
    } catch (error: any) {
      console.error('AI Action failed:', error);
      toast.error(error.message || 'Failed to perform AI action');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!editor?.getHTML() || editor.getText().trim() === '') {
      toast.error('Please enter some content');
      return;
    }

    setIsSubmitting(true);
    try {
      const newPost = await communityService.createPost({
        title,
        content: editor.getHTML(),
        category,
        tags,
        coverImage: coverImage || undefined,
      });
      toast.success('Post published successfully!');
      navigate(`/community/${newPost.id}`);
    } catch (error) {
      console.error('Failed to create post:', error);
      toast.error('Failed to publish post');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="min-h-full bg-white dark:bg-zinc-950 relative">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/community')}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium">
            <span>Community</span>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">Draft</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500/50 text-zinc-900 dark:text-zinc-100 cursor-pointer"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish'}
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="max-w-3xl mx-auto px-6 sm:px-12 py-12 pb-32">
        
        {/* Cover Image Area */}
        {coverImage ? (
          <div className="relative w-full h-64 sm:h-80 mb-12 rounded-3xl overflow-hidden group">
            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Change Cover
              </button>
              <button 
                onClick={() => setCoverImage('')}
                className="px-4 py-2 bg-rose-500/80 hover:bg-rose-500 backdrop-blur-md text-white rounded-xl font-medium transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-8 flex items-center gap-4 opacity-0 hover:opacity-100 transition-opacity duration-300 focus-within:opacity-100">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <ImagePlus className="w-4 h-4" /> Add Cover
            </button>
          </div>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleCoverUpload} 
          accept="image/*" 
          className="hidden" 
        />

        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article Title"
          className="w-full text-4xl sm:text-5xl font-black text-zinc-900 dark:text-zinc-100 bg-transparent border-none outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700 mb-6 resize-none"
        />

        {/* Tags Input */}
        <div className="flex flex-wrap items-center gap-2 mb-12">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md text-xs font-medium">
              #{tag}
              <button onClick={() => handleRemoveTag(tag)} className="hover:text-rose-500 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {tags.length < 5 && (
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder={tags.length === 0 ? "Add tags..." : "+ Add tag"}
              className="bg-transparent border-none outline-none text-sm text-zinc-500 dark:text-zinc-400 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 w-32"
            />
          )}
        </div>

        {/* Tiptap Editor */}
        <div className="relative">
          {/* BubbleMenu (appears on selection) */}
          {editor && (
            <BubbleMenu editor={editor} className="flex items-center gap-1 p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl overflow-hidden">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('strike') ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
              >
                <Strikethrough className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
              <button
                onClick={setLink}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('link') ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
              >
                <LinkIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('highlight') ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
              >
                <Highlighter className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
              <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-1">
                <button
                  onClick={() => handleAIAction('improve')}
                  className="p-1.5 rounded-lg transition-colors text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 flex items-center gap-1 text-xs font-medium"
                  title="Improve writing"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Improve
                </button>
                <button
                  onClick={() => handleAIAction('fix')}
                  className="px-2 py-1.5 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium"
                  title="Fix spelling & grammar"
                >
                  Fix
                </button>
                <button
                  onClick={() => handleAIAction('shorter')}
                  className="px-2 py-1.5 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium"
                  title="Make shorter"
                >
                  Shorter
                </button>
                <button
                  onClick={() => handleAIAction('longer')}
                  className="px-2 py-1.5 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium"
                  title="Make longer"
                >
                  Longer
                </button>
              </div>
            </BubbleMenu>
          )}

          {/* FloatingMenu (appears on empty lines) */}
          {editor && (
            <FloatingMenu editor={editor} className="flex items-center gap-1 -ml-12">
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl p-1">
                <button
                  onClick={() => setShowAIPrompt(true)}
                  className="p-1.5 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors flex items-center gap-1 text-sm font-medium"
                  title="Ask AI to write"
                >
                  <Sparkles className="w-4 h-4" /> Ask AI
                </button>
                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                <button
                  onClick={() => handleAIAction('continue')}
                  className="px-2 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
                  title="Continue writing"
                >
                  Continue
                </button>
                <button
                  onClick={() => handleAIAction('summarize')}
                  className="px-2 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
                  title="Summarize article"
                >
                  Summarize
                </button>
              </div>
              
              <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl ml-2">
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Heading 2"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Bullet List"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Task List"
                >
                  <CheckSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Code Block"
                >
                  <Code className="w-4 h-4" />
                </button>
                <button
                  onClick={addImage}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Add Image"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </div>
            </FloatingMenu>
          )}

          {/* AI Prompt Popover */}
          {showAIPrompt && (
            <div className="absolute z-50 left-0 right-0 -mt-16 bg-white dark:bg-zinc-900 border border-primary-200 dark:border-primary-900/50 shadow-2xl shadow-primary-500/10 rounded-2xl p-2 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <input
                ref={aiInputRef}
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerateAI();
                  if (e.key === 'Escape') setShowAIPrompt(false);
                }}
                placeholder="Tell AI what to write..."
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                disabled={isGenerating}
              />
              <button
                onClick={() => setShowAIPrompt(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                disabled={isGenerating}
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleGenerateAI}
                disabled={!aiPrompt.trim() || isGenerating}
                className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}

          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
