require 'sinatra'
require "sinatra/reloader" if development?
require 'active_record'
require 'digest/sha1'
require 'bcrypt'
require 'pry'
require 'uri'
require 'open-uri'
# require 'nokogiri'

###########################################################
# Configuration
###########################################################

enable :sessions

set :public_folder, File.dirname(__FILE__) + '/public'

configure :development, :production do
    ActiveRecord::Base.establish_connection(
       :adapter => 'sqlite3',
       :database =>  'db/dev.sqlite3.db'
     )
end

# Handle potential connection pool timeout issues
after do
    ActiveRecord::Base.connection.close
end

# turn off root element rendering in JSON
ActiveRecord::Base.include_root_in_json = false

###########################################################
# Models
###########################################################
# Models to Access the database through ActiveRecord.
# Define associations here if need be
# http://guides.rubyonrails.org/association_basics.html

class Link < ActiveRecord::Base
    attr_accessible :url, :code, :visits, :title

    has_many :clicks

    validates :url, presence: true

    before_save do |record|
        record.code = Digest::SHA1.hexdigest(url)[0,5]
    end
end

class Click < ActiveRecord::Base
    belongs_to :link, counter_cache: :visits
end

class User < ActiveRecord::Base
    attr_accessible :username, :password, :salt, :identifier

    def authenticate(password)
        self.password === BCrypt::Engine.hash_secret(password, self.salt)
    end

    before_create do |record|
        record.salt       = BCrypt::Engine.generate_salt
        record.password   = BCrypt::Engine.hash_secret record.password, record.salt
        record.identifier = Digest::SHA1.hexdigest record.to_s
    end
end



###########################################################
# Routes
###########################################################

get '/' do
    erb :layout
end

get "/create" do
    erb :layout
end

get '/login' do
    erb :layout
end

post '/login' do
    data = JSON.parse request.body.read
    user = User.find_by_username(data['username'])
    if !user.nil? and user.authenticate(data['password'])
        session[:identifier] = user.identifier
        halt 200, {identifier: user.identifier}.to_json
    end
    status 401
    {error: "Username or password incorrect."}.to_json
end

get '/signup' do
    erb :layout
end

post '/signup' do
    data = JSON.parse request.body.read
    user = User.find_by_username(data['username'])
    unless user.nil?
        halt 401, {error: "Username taken."}.to_json
    else
        user = User.create( username: data['username'], password: data['password'] )
        session[:identifier] = user.identifier if user.valid?
        {identifier: user.identifier}.to_json
    end
end

get '/logout' do
  session[:identifier] = nil
end

get "/links" do
    links = Link.order("created_at DESC")
    links.map { |link|
        link.as_json.merge(base_url: request.base_url)
    }.to_json
end

get "/stats/:code" do
    link = Link.find_by_code(params[:code]);
    unless link.nil?
        clicks = link.clicks.map { |click|
            click['created_at'].as_json
        }
        {title: link[:title], clicks: clicks}.to_json
    else
        {title: "Link not found.", clicks: []}.to_json
    end
end

post '/links' do
    data = JSON.parse request.body.read
    uri = URI(data['url'])
    raise Sinatra::NotFound unless uri.absolute?
    link = Link.find_by_url(uri.to_s) ||
           Link.create( url: uri.to_s, title: get_url_title(uri) )
    link.as_json.merge(base_url: request.base_url).to_json
end

get "/:url" do
    link = Link.find_by_code params[:url]
    raise Sinatra::NotFound if link.nil?
    link.clicks.create!
    redirect link.url
end

###########################################################
# Utility
###########################################################

def read_url_head url
    head = ""
    url.open do |u|
        begin
            line = u.gets
            next  if line.nil?
            head += line
            break if line =~ /<\/head>/
        end until u.eof?
    end
    head + "</html>"
end

def get_url_title url
    # Nokogiri::HTML.parse( read_url_head url ).title
    result = read_url_head(url).match(/<title>(.*)<\/title>/)
    result.nil? ? "" : result[1]
end

def logged_in?
    !!current_user
end

def current_user
    User.find_by_identifier session[:identifier]
end