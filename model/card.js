function Card(ticket,card) {
    var self = this;
    
    self.id = card.id != null ? card.id : "";
    
    self.due = null;
    //if (ticket.Created != null)
    //    self.due = ticket.Created; //Tá errado, porque não vi ainda em qual campo o OTRS traz o due date
    
    self.name = ticket.TicketNumber + ' - ' + ticket.Subject;
    
    self.urlSource = null;  
    
    self.state = ticket.State;

    return self;
}

module.exports = Card;