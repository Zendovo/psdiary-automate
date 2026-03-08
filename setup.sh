#!/bin/bash

echo "=== PS Diary Bot Setup ==="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✓ .env file created"
    echo ""
    echo "⚠️  Please edit the .env file and add your credentials:"
    echo "   - PS_USERNAME"
    echo "   - PS_PASSWORD"
    echo "   - OPENAI_API_KEY (or configure custom API)"
    echo ""
else
    echo "✓ .env file already exists"
fi

# Check if learnings.json exists
if [ ! -f learnings.json ]; then
    echo "⚠️  learnings.json not found!"
    echo "   Please create it with your weekly learnings"
else
    echo "✓ learnings.json exists"
fi

echo ""
echo "Installation complete! Next steps:"
echo ""
echo "1. Edit .env with your credentials"
echo "2. Update learnings.json with your weekly activities"
echo "3. Run: npm run dev"
echo ""
