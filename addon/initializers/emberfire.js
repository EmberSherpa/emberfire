import Ember from 'ember';
import DS from 'ember-data';
import Firebase from 'firebase';
import FirebaseAdapter from '../adapters/firebase';
import FirebaseSerializer from '../serializers/firebase';

var VERSION = '0.0.0';

if (Ember.libraries) {
  if (Firebase.SDK_VERSION) {
    Ember.libraries.registerCoreLibrary('Firebase', Firebase.SDK_VERSION);
  }

  Ember.libraries.registerCoreLibrary('EmberFire', VERSION);
}

export default {
  name: 'emberfire',
  before: 'ember-data',
  initialize: function (container, app) {
    var config = container.lookupFactory('config:environment');
    if (config.disableFirebase) {
      return;
    }
    
    app.register('adapter:-firebase', FirebaseAdapter);
    app.register('serializer:-firebase', FirebaseSerializer);

    // Monkeypatch the store until ED gives us a good way to listen to push events
    if (!DS.Store.prototype._emberfirePatched) {
      DS.Store.reopen({
        _emberfirePatched: true,
        push: function() {
          var record = this._super.apply(this, arguments);
          var modelName = record.constructor.modelName;
          var adapter = this.adapterFor(modelName);
          if (adapter.recordWasPushed) {
            adapter.recordWasPushed(this, modelName, record);
          }
          return record;
        },

        recordWillUnload: function(record) {
          var adapter = this.adapterFor(record.constructor.modelName);
          if (adapter.recordWillUnload) {
            adapter.recordWillUnload(this, record);
          }
        },

        recordWillDelete: function (record) {
          var adapter = this.adapterFor(record.constructor.modelName);
          if (adapter.recordWillDelete) {
            adapter.recordWillDelete(this, record);
          }
        }
      });
    }

    if (!DS.Model.prototype._emberfirePatched) {
      DS.Model.reopen({
        _emberfirePatched: true,
        unloadRecord: function() {
          this.store.recordWillUnload(this);
          return this._super();
        },
        deleteRecord: function () {
          this.store.recordWillDelete(this);
          this._super();
        },

        ref: function () {
          if (this.__firebaseRef) {
            return this.__firebaseRef;
          }

          var adapter = this.store.adapterFor(this.constructor.modelName);
          if (adapter._getRef) {
            return adapter._getRef(this.constructor, this.id);
          }
        }
      });
    }

    if (!DS.AdapterPopulatedRecordArray.prototype._emberfirePatched) {
      DS.AdapterPopulatedRecordArray.reopen({
        _emberfirePatched: true,
        willDestroy: function() {
          if (this.__firebaseCleanup) {
            this.__firebaseCleanup();
          }
          return this._super();
        }
      });
    }

    DS.FirebaseAdapter = FirebaseAdapter;
    DS.FirebaseSerializer = FirebaseSerializer;
  }
};
