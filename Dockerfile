# Backend API (PHP + Apache) para Tennis-web
FROM php:8.2-apache

# Extensión MySQL para PDO
RUN docker-php-ext-install pdo pdo_mysql

# DocumentRoot = directorio public del backend
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Permitir .htaccess (rewrite)
RUN a2enmod rewrite
