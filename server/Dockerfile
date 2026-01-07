FROM python:3.11-alpine

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create directories
RUN mkdir -p /downloads /app/data

# Expose port
EXPOSE 5000

# Run application
CMD ["python", "app.py"]
