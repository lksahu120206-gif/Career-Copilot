from langchain_core.documents import Document
import os
from langchain_community.document_loaders import PyPDFLoader, TextLoader, WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

# Define our directories
DATA_DIR = "./data"
DB_DIR = "./chroma_db"

def build_database():
    print("🚀 Starting knowledge base ingestion...")
    documents: list[Document] = []

    # 1. Load Local Files (PDFs and Text/Markdown)
    if os.path.exists(DATA_DIR):
        for filename in os.listdir(DATA_DIR):
            filepath = os.path.join(DATA_DIR, filename)
            if filename.endswith(".pdf"):
                print(f"📄 Loading PDF: {filename}")
                loader = PyPDFLoader(filepath)
                documents.extend(loader.load())
            elif filename.endswith((".txt", ".md")):
                print(f"📝 Loading Text/Markdown: {filename}")
                loader = TextLoader(filepath, encoding="utf-8")
                documents.extend(loader.load())
    else:
        print(f"⚠️ Warning: {DATA_DIR} folder not found. Create it to load local files.")

    # 2. Load Specific Web Pages
    urls_to_scrape = [
        "https://roadmap.sh/frontend",
    ]
    
    print("🌐 Scraping web pages...")
    for url in urls_to_scrape:
        try:
            loader = WebBaseLoader(url)
            documents.extend(loader.load())
            print(f"✅ Successfully scraped: {url}")
        except Exception as e:
            print(f"❌ Failed to scrape {url}: {e}")

    if not documents:
        print("🛑 No documents found! Add files to /data or check your URLs.")
        return

    # 3. Split documents into chunks
    print(f"✂️ Splitting {len(documents)} document pages into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, 
        chunk_overlap=200
    )
    chunks = text_splitter.split_documents(documents)
    print(f"📦 Created {len(chunks)} text chunks.")

    # 4. Create Embeddings and Store in ChromaDB
    print("🧠 Initializing embedding model...")
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    print("💾 Saving to Vector Database...")
    print("💾 Saving to Vector Database...")
    Chroma.from_documents( # type: ignore
        documents=chunks, 
        embedding=embeddings, 
        persist_directory=DB_DIR
    )
    
    print("🎉 Vector Database successfully built and saved to /chroma_db!")

if __name__ == "__main__":
    build_database()